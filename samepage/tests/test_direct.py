"""
Every method and every rule in section 2 of the build spec, through the test
double, with the judge mocked. The model's answers are queued per call: the
leader asks both presentation orders, then the validator asks both again, so a
check consumes four answers.
"""

from __future__ import annotations

import json
import pathlib

import pytest

import genvm_double as D
from harness import GEN, World, answer, raises

HERE = pathlib.Path(__file__).resolve().parent
ZERO = "0x" + "0" * 40
SALT_A = "aa" * 8
SALT_B = "bb" * 8


def same(world: World, page: int, **statuses) -> None:
    """A check where both orders and both nodes agree on the given statuses."""
    one = answer(**statuses)
    world.check(page, one, one, one, one)


@pytest.fixture
def w() -> World:
    return World()


def joined(w: World, deposit: int = 20 * GEN) -> int:
    page = w.open(deposit)
    w.join(page, deposit)
    return page


# --- open_page --------------------------------------------------------------

def test_open_page_records_everything(w):
    page = w.open()
    assert page == 1
    row = w.page(page)
    assert row["title"] == "Kiln launch posts"
    assert row["opener"].lower() == w.KILN
    assert row["counterparty"].lower() == w.SERA
    assert row["deposit"] == str(20 * GEN)
    assert row["window_hours"] == 48
    assert row["step"] == "JOINING"
    assert row["round"] == 1
    assert row["deadline"] == w.t + 48 * 3600
    assert row["terms"] == ["amount", "deliverable", "deadline", "payment", "rights", "cancellation"]
    assert row["required"] == ["amount", "deliverable", "deadline"]
    w.check_invariants()


@pytest.mark.parametrize("title", ["", "   ", "x" * 81])
def test_title_is_one_to_eighty(w, title):
    w.sender(w.KILN, 0)
    raises("title", w.c.open_page, title, w.SERA, 0, 48)


def test_title_of_eighty_is_accepted_and_trimmed(w):
    w.sender(w.KILN, 0)
    page = w.c.open_page("  " + "x" * 80 + "  ", w.SERA, 0, 48)
    assert w.page(page)["title"] == "x" * 80


@pytest.mark.parametrize("hours", [0, 5, 97, 1000])
def test_window_is_six_to_ninety_six_hours(w, hours):
    w.sender(w.KILN, 0)
    raises("window", w.c.open_page, "t", w.SERA, 0, hours)


@pytest.mark.parametrize("hours", [6, 96])
def test_window_bounds_are_inclusive(w, hours):
    w.sender(w.KILN, 0)
    page = w.c.open_page("t", w.SERA, 0, hours)
    assert w.page(page)["window_hours"] == hours


def test_counterparty_must_be_someone_else(w):
    w.sender(w.KILN, 0)
    raises("cannot be the opener", w.c.open_page, "t", w.KILN, 0, 48)
    raises("zero address", w.c.open_page, "t", ZERO, 0, 48)
    raises("not an address", w.c.open_page, "t", "kiln.eth", 0, 48)
    raises("not an address", w.c.open_page, "t", "0x" + "zz" * 20, 0, 48)


def test_the_value_sent_must_be_the_deposit(w):
    w.sender(w.KILN, 19 * GEN)
    raises("exactly the deposit", w.c.open_page, "t", w.SERA, 20 * GEN, 48)
    w.sender(w.KILN, 0)
    raises("exactly the deposit", w.c.open_page, "t", w.SERA, 20 * GEN, 48)
    w.sender(w.KILN, 0)
    raises("negative", w.c.open_page, "t", w.SERA, -1, 48)


def test_a_zero_deposit_page_runs_end_to_end(w):
    page = joined(w, 0)
    w.write_round(page)
    same(w, page)
    w.sender(w.KILN)
    w.c.sign(page)
    w.sender(w.SERA)
    w.c.sign(page)
    assert w.page(page)["step"] == "AGREED"
    assert w.balance(w.KILN) == 0
    w.check_invariants()


# --- join -------------------------------------------------------------------

def test_only_the_named_counterparty_joins(w):
    page = w.open()
    w.sender(w.STRANGER, 20 * GEN)
    raises("named counterparty", w.c.join, page)
    w.sender(w.KILN, 20 * GEN)
    raises("named counterparty", w.c.join, page)


def test_join_needs_the_same_deposit(w):
    page = w.open()
    w.sender(w.SERA, 10 * GEN)
    raises("exactly the deposit", w.c.join, page)


def test_join_moves_to_sealing_with_a_fresh_window(w):
    page = w.open()
    w.advance(3600)
    w.join(page)
    row = w.page(page)
    assert row["step"] == "SEALING"
    assert row["deadline"] == w.t + 48 * 3600
    w.check_invariants()


def test_join_twice_or_late_is_refused(w):
    page = w.open()
    w.join(page)
    w.sender(w.SERA, 20 * GEN)
    raises("not waiting", w.c.join, page)
    late = w.open()
    w.advance(48 * 3600 + 1)
    w.sender(w.SERA, 20 * GEN)
    raises("window", w.c.join, late)


def test_unknown_page_is_refused_everywhere(w):
    w.sender(w.SERA, 0)
    raises("no such page", w.c.join, 7)
    raises("no such page", w.c.seal, 7, "ab" * 32)
    raises("no such page", w.c.reveal, 7, "x", SALT_A)
    raises("no such page", w.c.check, 7)
    raises("no such page", w.c.sign, 7)
    raises("no such page", w.c.no_show, 7)
    raises("no such page", w.c.get_page, 7)


# --- seal -------------------------------------------------------------------

def test_seal_before_join_is_refused(w):
    page = w.open()
    w.sender(w.KILN)
    raises("not taking seals", w.c.seal, page, "ab" * 32)


def test_only_a_side_seals(w):
    page = joined(w)
    w.sender(w.STRANGER)
    raises("not a side", w.c.seal, page, "ab" * 32)


@pytest.mark.parametrize("value", ["", "ab" * 31, "ab" * 33, "zz" * 32, "hello"])
def test_a_seal_is_sixty_four_hex(w, value):
    page = joined(w)
    w.sender(w.KILN)
    raises("64 hex", w.c.seal, page, value)


def test_a_seal_with_0x_and_upper_case_is_normalised(w):
    page = joined(w)
    w.sender(w.KILN)
    w.c.seal(page, "0x" + "AB" * 32)
    assert w.page(page)["rounds"][0]["a_seal"] == "ab" * 32


def test_seal_once_per_side_per_round(w):
    page = joined(w)
    w.seal(page, w.KILN, "A", SALT_A)
    w.sender(w.KILN)
    raises("sealed this round already", w.c.seal, page, "cd" * 32)


def test_copying_the_other_sides_seal_is_refused(w):
    page = joined(w)
    value = w.seal(page, w.KILN, "A", SALT_A)
    w.sender(w.SERA)
    raises("other side's seal", w.c.seal, page, value)


def test_both_seals_open_the_opening_step(w):
    page = joined(w)
    w.seal(page, w.KILN, "A", SALT_A)
    assert w.page(page)["step"] == "SEALING"
    w.advance(100)
    w.seal(page, w.SERA, "B", SALT_B)
    row = w.page(page)
    assert row["step"] == "OPENING"
    assert row["deadline"] == w.t + 48 * 3600
    assert row["rounds"][0]["sealed_at"] == w.t
    # Sealed means sealed: nothing but hashes is on the page.
    assert row["rounds"][0]["a_text"] == "" and row["rounds"][0]["b_text"] == ""


def test_seal_after_the_window_is_refused(w):
    page = joined(w)
    w.advance(48 * 3600 + 1)
    w.sender(w.KILN)
    raises("window", w.c.seal, page, "ab" * 32)


# --- reveal -----------------------------------------------------------------

def test_neither_side_opens_before_both_sealed(w):
    page = joined(w)
    w.seal(page, w.KILN, "A", SALT_A)
    w.sender(w.KILN)
    raises("only after both sides have sealed", w.c.reveal, page, "A", SALT_A)


def test_an_account_that_does_not_match_its_seal_is_rejected(w):
    page = joined(w)
    w.seal(page, w.KILN, "600 USDC", SALT_A)
    w.seal(page, w.SERA, "600 USDC", SALT_B)
    w.sender(w.KILN)
    raises("does not match", w.c.reveal, page, "700 USDC", SALT_A)
    raises("does not match", w.c.reveal, page, "600 USDC", SALT_B)


def test_a_seal_made_for_the_other_address_cannot_be_opened(w):
    """Sera seals Kiln's preimage under Kiln's address and cannot open it."""
    page = joined(w)
    w.seal(page, w.KILN, "Kiln's words", SALT_A)
    copied = w.mod.seal_of("Kiln's words", SALT_B, w.KILN)
    w.sender(w.SERA)
    w.c.seal(page, copied)
    raises("does not match", w.c.reveal, page, "Kiln's words", SALT_B)


def test_the_salt_cannot_carry_the_separator(w):
    """
    With a free-form salt, "A|B" sealed with salt "r" could be opened later as
    text "A" and salt "B|r", choosing the account after reading the other side.
    Hex-only salts make the split unique.
    """
    page = joined(w)
    w.sender(w.KILN)
    w.c.seal(page, w.mod.seal_of("A", "B|" + SALT_A, w.KILN))
    w.seal(page, w.SERA, "B", SALT_B)
    w.sender(w.KILN)
    raises("salt", w.c.reveal, page, "A", "B|" + SALT_A)


@pytest.mark.parametrize("salt", ["", "abc", "AA" * 8, "g" * 16, "a" * 65, "a|" * 8])
def test_a_salt_is_sixteen_to_sixty_four_lower_hex(w, salt):
    page = joined(w)
    w.write_round  # noqa: B018 - documentation of the helper this test does not use
    w.seal(page, w.KILN, "A", SALT_A)
    w.seal(page, w.SERA, "B", SALT_B)
    w.sender(w.KILN)
    raises("salt", w.c.reveal, page, "A", salt)


def test_an_account_is_one_to_twelve_hundred_characters(w):
    page = joined(w)
    long_ok = "x" * 1200
    w.seal(page, w.KILN, long_ok, SALT_A)
    w.seal(page, w.SERA, "x" * 1201, SALT_B)
    w.reveal(page, w.KILN, long_ok, SALT_A)
    w.sender(w.SERA)
    raises("1,200", w.c.reveal, page, "x" * 1201, SALT_B)
    raises("1,200", w.c.reveal, page, "   ", SALT_B)


def test_a_persian_account_counts_characters_not_bytes(w):
    page = joined(w)
    text = "س" * 1200  # 2,400 UTF-8 bytes, 1,200 characters
    w.seal(page, w.KILN, text, SALT_A)
    w.seal(page, w.SERA, "B", SALT_B)
    w.reveal(page, w.KILN, text, SALT_A)
    assert w.page(page)["rounds"][0]["a_text"] == text


def test_open_once_and_both_opens_move_to_checking(w):
    page = joined(w)
    w.seal(page, w.KILN, "A", SALT_A)
    w.seal(page, w.SERA, "B", SALT_B)
    w.reveal(page, w.KILN, "A", SALT_A)
    w.sender(w.KILN)
    raises("opened this round already", w.c.reveal, page, "A", SALT_A)
    w.reveal(page, w.SERA, "B", SALT_B)
    row = w.page(page)
    assert row["step"] == "CHECKING"
    assert row["rounds"][0]["a_text"] == "A" and row["rounds"][0]["b_salt"] == SALT_B


def test_reveal_after_the_window_is_refused(w):
    page = joined(w)
    w.seal(page, w.KILN, "A", SALT_A)
    w.seal(page, w.SERA, "B", SALT_B)
    w.advance(48 * 3600 + 1)
    w.sender(w.KILN)
    raises("window", w.c.reveal, page, "A", SALT_A)


def test_the_shared_vectors_match_the_contract(w):
    vectors = json.loads((HERE / "vectors.json").read_text(encoding="utf-8"))["vectors"]
    assert len(vectors) >= 5
    for v in vectors:
        assert w.mod.seal_of(v["text"], v["salt"], v["address"]) == v["seal"], v["text"][:30]


# --- check and the verdict rule ---------------------------------------------

def test_check_needs_both_accounts_open(w):
    page = joined(w)
    w.sender(w.STRANGER)
    raises("not ready", w.c.check, page)


def test_check_is_open_to_anyone(w):
    page = joined(w)
    w.write_round(page)
    same(w, page, who=None) if False else same(w, page)
    assert w.page(page)["step"] == "SIGNING"


def test_all_match_is_same_page_and_opens_signing(w):
    page = joined(w)
    w.write_round(page)
    same(w, page)
    row = w.page(page)
    r = row["rounds"][0]
    assert r["verdict"] == "SAME_PAGE"
    assert r["statuses"] == ["MATCH"] * 6
    assert row["step"] == "SIGNING"
    assert row["deadline"] == w.t + 48 * 3600
    assert r["notes"]["amount"] == "both on amount"


def test_absent_optional_terms_still_allow_same_page(w):
    page = joined(w)
    w.write_round(page)
    same(w, page, payment="ABSENT", rights="ABSENT", cancellation="ABSENT")
    assert w.page(page)["rounds"][0]["verdict"] == "SAME_PAGE"


@pytest.mark.parametrize("term", ["amount", "deliverable", "deadline"])
def test_a_required_term_absent_from_both_is_a_gap(w, term):
    page = joined(w)
    w.write_round(page)
    same(w, page, **{term: "ABSENT"})
    row = w.page(page)
    assert row["rounds"][0]["verdict"] == "GAPS"
    assert row["step"] == "SEALING" and row["round"] == 2


def test_any_differ_is_different_even_with_gaps(w):
    page = joined(w)
    w.write_round(page)
    same(w, page, amount="ABSENT", cancellation="DIFFER")
    assert w.page(page)["rounds"][0]["verdict"] == "DIFFERENT"


def test_the_verdict_never_comes_from_the_model(w):
    """A model that adds its own verdict field changes nothing."""
    page = joined(w)
    w.write_round(page)
    body = json.loads(answer(payment="DIFFER"))
    body["verdict"] = "SAME_PAGE"
    one = json.dumps(body)
    w.check(page, one, one, one, one)
    assert w.page(page)["rounds"][0]["verdict"] == "DIFFERENT"


def test_the_two_orders_disagreeing_stores_differ(w):
    """Position bias resolved in the value: a term read two ways is not agreed."""
    page = joined(w)
    w.write_round(page)
    forward = answer()
    reverse = answer(deadline="ABSENT")
    w.check(page, forward, reverse, forward, reverse)
    r = w.page(page)["rounds"][0]
    assert r["statuses"][2] == "DIFFER"
    assert r["split"] == ["deadline"]
    assert r["verdict"] == "DIFFERENT"


def test_validators_compare_statuses_not_notes(w):
    page = joined(w)
    w.write_round(page)
    leader = answer()
    body = json.loads(answer())
    body["notes"] = {"amount": "something else entirely"}
    validator = json.dumps(body)
    w.check(page, leader, leader, validator, validator)
    assert w.gl.bus.validator_votes[-1] is True
    assert w.page(page)["rounds"][0]["notes"]["amount"] == "both on amount"


def test_a_validator_reading_a_different_status_disagrees(w):
    page = joined(w)
    w.write_round(page)
    leader = answer()
    other = answer(rights="DIFFER")
    w.gl.nondet.answers.extend([leader, leader, other, other])
    w.sender(w.STRANGER)
    with pytest.raises(D.VMError):
        w.c.check(page)
    assert w.page(page)["rounds"][0]["verdict"] == ""
    assert w.page(page)["step"] == "CHECKING"


def test_a_malformed_answer_gets_one_retry(w):
    page = joined(w)
    w.write_round(page)
    good = answer()
    w.check(page, "I think they agree.", good, good, good, good)
    assert w.page(page)["rounds"][0]["verdict"] == "SAME_PAGE"


def test_an_unknown_status_is_an_error_not_an_absent(w):
    page = joined(w)
    w.write_round(page)
    bad = answer(amount="PROBABLY")
    w.gl.nondet.answers.extend([bad, bad, bad, bad])
    w.sender(w.STRANGER)
    with pytest.raises(D.VMError):
        w.c.check(page)


def test_a_fenced_answer_in_a_code_block_is_read(w):
    page = joined(w)
    w.write_round(page)
    fenced = "```json\n" + answer() + "\n```"
    w.check(page, fenced, fenced, fenced, fenced)
    assert w.page(page)["rounds"][0]["verdict"] == "SAME_PAGE"


def test_a_round_is_checked_once(w):
    page = joined(w)
    w.write_round(page)
    same(w, page)
    w.sender(w.STRANGER)
    raises("not ready", w.c.check, page)


def test_round_two_starts_clean_and_keeps_round_one(w):
    page = joined(w)
    w.write_round(page, "Kiln round one", "Sera round one")
    same(w, page, deliverable="DIFFER", payment="DIFFER")
    row = w.page(page)
    assert row["round"] == 2 and row["step"] == "SEALING"
    assert len(row["rounds"]) == 2
    assert row["rounds"][0]["verdict"] == "DIFFERENT"
    assert row["rounds"][0]["a_text"] == "Kiln round one"
    assert row["rounds"][1]["a_seal"] == "" and row["rounds"][1]["verdict"] == ""


def test_either_side_may_keep_their_text_in_round_two(w):
    page = joined(w)
    w.write_round(page, "Same words", "Other words")
    same(w, page, payment="DIFFER")
    w.write_round(page, "Same words", "Same words now")
    assert w.page(page)["rounds"][1]["a_text"] == "Same words"


def test_a_second_round_that_differs_closes_not_agreed_and_returns_both(w):
    page = joined(w)
    w.write_round(page)
    same(w, page, payment="DIFFER")
    w.write_round(page)
    same(w, page, payment="DIFFER")
    row = w.page(page)
    assert row["step"] == "NOT_AGREED"
    assert row["rounds"][1]["verdict"] == "DIFFERENT"
    assert w.balance(w.KILN) == 20 * GEN
    assert w.balance(w.SERA) == 20 * GEN
    assert w.withdraw(w.KILN) == 20 * GEN
    w.check_invariants()


def test_check_moves_no_money(w):
    page = joined(w)
    w.write_round(page)
    same(w, page, payment="DIFFER")
    w.write_round(page)
    same(w, page, amount="ABSENT")
    assert w.gl.bus.transfers == []


# --- sign -------------------------------------------------------------------

def signing(w: World) -> int:
    page = joined(w)
    w.write_round(page)
    same(w, page)
    return page


def test_only_a_same_page_record_is_signed(w):
    page = joined(w)
    w.sender(w.KILN)
    raises("only a SAME PAGE record", w.c.sign, page)


def test_a_stranger_cannot_sign(w):
    page = signing(w)
    w.sender(w.STRANGER)
    raises("not a side", w.c.sign, page)


def test_sign_once_and_both_make_it_agreed(w):
    page = signing(w)
    w.sender(w.KILN)
    w.c.sign(page)
    raises("signed already", w.c.sign, page)
    assert w.page(page)["step"] == "SIGNING"
    w.sender(w.SERA)
    w.c.sign(page)
    row = w.page(page)
    assert row["step"] == "AGREED"
    assert row["rounds"][0]["a_signed"] and row["rounds"][0]["b_signed"]
    assert row["closed_at"] == w.t
    assert w.gl.bus.transfers == [], "sign moves balances, never money"
    assert w.balance(w.KILN) == 20 * GEN and w.balance(w.SERA) == 20 * GEN
    w.check_invariants()


def test_sign_after_the_window_is_refused(w):
    page = signing(w)
    w.advance(48 * 3600 + 1)
    w.sender(w.KILN)
    raises("window", w.c.sign, page)


# --- no_show ----------------------------------------------------------------

def test_no_show_waits_for_the_window(w):
    page = w.open()
    w.sender(w.STRANGER)
    raises("still open", w.c.no_show, page)
    w.advance(48 * 3600)
    raises("still open", w.c.no_show, page)


def test_counterparty_never_joins_returns_the_openers_deposit(w):
    page = w.open()
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    w.c.no_show(page)
    row = w.page(page)
    assert row["step"] == "NO_SHOW"
    assert row["absent"] == [w.SERA]
    assert w.balance(w.KILN) == 20 * GEN
    assert w.listing(w.SERA)["no_shows"] == 1
    w.check_invariants()


def test_a_side_that_never_seals_loses_its_deposit_to_the_other(w):
    page = joined(w)
    w.seal(page, w.SERA, "B", SALT_B)
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    w.c.no_show(page)
    assert w.page(page)["absent"] == [w.KILN]
    assert w.balance(w.SERA) == 40 * GEN
    assert w.balance(w.KILN) == 0
    assert w.withdraw(w.SERA) == 40 * GEN
    w.check_invariants()


def test_a_side_that_copied_a_seal_cannot_open_and_pays_for_it(w):
    page = joined(w)
    w.seal(page, w.KILN, "Kiln's words", SALT_A)
    w.sender(w.SERA)
    w.c.seal(page, w.mod.seal_of("Kiln's words", SALT_B, w.KILN))
    w.reveal(page, w.KILN, "Kiln's words", SALT_A)
    w.advance(48 * 3600 + 1)
    w.sender(w.KILN)
    w.c.no_show(page)
    assert w.page(page)["absent"] == [w.SERA]
    assert w.balance(w.KILN) == 40 * GEN
    w.check_invariants()


def test_a_side_that_will_not_sign_a_same_page_record_is_a_no_show(w):
    page = signing(w)
    w.sender(w.KILN)
    w.c.sign(page)
    w.advance(48 * 3600 + 1)
    w.sender(w.SERA)
    w.c.no_show(page)
    assert w.page(page)["absent"] == [w.SERA]
    assert w.balance(w.KILN) == 40 * GEN
    w.check_invariants()


def test_both_missing_the_same_step_each_get_their_own_back(w):
    page = joined(w)
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    w.c.no_show(page)
    row = w.page(page)
    assert sorted(row["absent"]) == sorted([w.KILN, w.SERA])
    assert w.balance(w.KILN) == 20 * GEN and w.balance(w.SERA) == 20 * GEN
    w.check_invariants()


def test_a_check_that_never_lands_cannot_hold_deposits(w):
    page = joined(w)
    w.write_round(page)
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    w.c.no_show(page)
    row = w.page(page)
    assert row["step"] == "NOT_AGREED" and row["absent"] == []
    assert w.balance(w.KILN) == 20 * GEN and w.balance(w.SERA) == 20 * GEN
    w.check_invariants()


def test_no_show_on_a_closed_page_is_refused(w):
    page = signing(w)
    for who in (w.KILN, w.SERA):
        w.sender(who)
        w.c.sign(page)
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    raises("closed", w.c.no_show, page)


def test_no_show_moves_no_money(w):
    page = joined(w)
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    w.c.no_show(page)
    assert w.gl.bus.transfers == []


# --- withdraw ---------------------------------------------------------------

def test_withdraw_pays_the_whole_balance_once(w):
    page = signing(w)
    for who in (w.KILN, w.SERA):
        w.sender(who)
        w.c.sign(page)
    assert w.withdraw(w.KILN) == 20 * GEN
    transfer = w.gl.bus.transfers[-1]
    assert transfer.to.lower() == w.KILN
    assert w.balance(w.KILN) == 0
    w.sender(w.KILN)
    raises("nothing to withdraw", w.c.withdraw)
    w.check_invariants()


def test_withdraw_with_nothing_is_refused(w):
    w.sender(w.STRANGER)
    raises("nothing to withdraw", w.c.withdraw)


def test_balances_accumulate_across_pages(w):
    first = signing(w)
    for who in (w.KILN, w.SERA):
        w.sender(who)
        w.c.sign(first)
    second = w.open()
    w.advance(48 * 3600 + 1)
    w.sender(w.STRANGER)
    w.c.no_show(second)
    assert w.balance(w.KILN) == 40 * GEN
    assert w.withdraw(w.KILN) == 40 * GEN
    w.check_invariants()


# --- views ------------------------------------------------------------------

def test_list_pages_by_address_newest_first(w):
    one = w.open(title="one")
    two = w.open(title="two", other=w.STRANGER)
    three = w.open(title="three", who=w.SERA, other=w.KILN)
    kiln = w.listing(w.KILN)
    assert [p["id"] for p in kiln["pages"]] == [three, two, one]
    assert kiln["total"] == 3
    sera = w.listing(w.SERA)
    assert [p["id"] for p in sera["pages"]] == [three, one]
    assert [p["id"] for p in w.listing(w.KILN, 1, 1)["pages"]] == [two]
    assert w.listing(w.STRANGER)["balance"] == "0"
    # Lists carry no account text; only get_page does.
    assert "a_text" not in kiln["pages"][0]["rounds"][0]


def test_the_zero_address_lists_every_page(w):
    for title in ("a", "b", "c"):
        w.open(title=title)
    rows = w.listing(ZERO)
    assert rows["total"] == 3
    assert [p["title"] for p in rows["pages"]] == ["c", "b", "a"]
    assert rows["held"] == str(60 * GEN)


def test_list_limit_is_capped(w):
    for i in range(3):
        w.open(title=str(i))
    assert len(w.listing(ZERO, 0, 1000)["pages"]) == 3
    assert w.listing(ZERO, 0, -5)["pages"] == []
    assert len(w.listing(ZERO, -3, 2)["pages"]) == 2


def test_list_pages_refuses_a_bad_address(w):
    raises("not an address", w.c.list_pages, "nobody", 0, 10)


# --- the demo journey from the spec ----------------------------------------

def test_kiln_and_sera_from_different_to_agreed(w):
    """Section 9's demo: DIFFERENT · 2, a second round, SAME PAGE, both sign."""
    kiln_1 = "Sera writes 3 posts and a thread about the Kiln launch, 600 USDC, all paid after the last post."
    sera_1 = "3 posts about the launch, 600 USDC, half before I start and half after"
    page = joined(w)
    w.write_round(page, kiln_1, sera_1)
    same(w, page, deliverable="DIFFER", payment="DIFFER", cancellation="ABSENT")
    r1 = w.page(page)["rounds"][0]
    assert r1["verdict"] == "DIFFERENT"
    assert [t for t, s in zip(w.mod.TERMS, r1["statuses"]) if s == "DIFFER"] == ["deliverable", "payment"]

    kiln_2 = "Sera writes 3 posts and one thread on X about the Kiln launch, all live by Oct 24. 600 USDC, half before and half after."
    sera_2 = "I write 3 posts and one thread on X about the Kiln launch, all live by Oct 24. 600 USDC, half before I start and half after."
    w.write_round(page, kiln_2, sera_2)
    same(w, page, cancellation="ABSENT", rights="ABSENT")
    assert w.page(page)["rounds"][1]["verdict"] == "SAME_PAGE"
    for who in (w.KILN, w.SERA):
        w.sender(who)
        w.c.sign(page)
    assert w.page(page)["step"] == "AGREED"
    assert w.withdraw(w.KILN) == 20 * GEN
    assert w.withdraw(w.SERA) == 20 * GEN
    w.check_invariants()
    assert int(w.c.held) == 0


# --- found by scripts/mutate.py ---------------------------------------------

def test_check_with_one_account_open_is_refused(w):
    """Both sealed and one opened is OPENING, not CHECKING."""
    page = joined(w)
    w.seal(page, w.KILN, "A", SALT_A)
    w.seal(page, w.SERA, "B", SALT_B)
    w.reveal(page, w.KILN, "A", SALT_A)
    w.sender(w.STRANGER)
    raises("not ready", w.c.check, page)


def test_a_list_is_never_longer_than_fifty(w):
    for i in range(52):
        w.open(title=str(i), deposit=0)
    rows = w.listing(ZERO, 0, 1000)
    assert rows["total"] == 52
    assert len(rows["pages"]) == 50
    assert len(w.listing(w.KILN, 0, 1000)["pages"]) == 50
