// Bootstrap for the offline test suite: registers the `@/*` alias resolver
// through the stable module.register API (not the deprecated --loader flag).
// Used via `node --import ./scripts/register-alias.mjs --test ...`.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./alias-loader.mjs', pathToFileURL('./scripts/'))
