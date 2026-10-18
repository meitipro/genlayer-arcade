"""Storage types for the double: plain lists and dicts."""


class _Generic:
    def __init__(self, empty) -> None:
        self._empty = empty

    def __getitem__(self, _item) -> "_Generic":
        return self

    def empty(self):
        return self._empty()


DynArray = _Generic(list)
TreeMap = _Generic(dict)


def allow(cls):
    return cls
