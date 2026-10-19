/**
 * This branch's root vercel.json builds Samepage instead of the arcade, so the
 * branch preview on the arcade's Vercel project serves Samepage. If this branch
 * were ever merged into the arcade's production branch, that build must fail
 * rather than replace the arcade: Vercel keeps the last good production
 * deployment when a build fails. A dedicated project rooted at samepage/web
 * uses samepage/web/vercel.json and never runs this.
 */
if (process.env.VERCEL_ENV === 'production') {
  console.error('Refusing to build Samepage as the arcade\'s production deployment. Restore the arcade\'s vercel.json on main.');
  process.exit(1);
}
console.log(`building Samepage (${process.env.VERCEL_ENV ?? 'local'}, branch ${process.env.VERCEL_GIT_COMMIT_REF ?? '?'})`);
