# BMH public YouTube collector

Prepared, disabled integration for https://terminal.alignmentlab.com.
Only @bunimediahub is collected. Sidequest is paused.

The collector reads official YouTube Data API v3 public channel/video counts. It does not read private Analytics, comment text, or viewer identities. Malfoid titles are review candidates, not an approved roster. No derived engagement scores, summed views, growth calculations, or population ratios are emitted.

## Status

There is no active recurring schedule. The manual workflow skips unless the owner-approved COLLECTOR_ENABLED repository variable is true. The destination's short-lived GitHub OIDC writer trust must be implemented, reviewed, configured and tested before activation. Never enable this draft as-is.

## Private configuration

The owner enters the existing restricted YouTube Data API v3 key directly in GitHub repository Settings > Secrets and variables > Actions > New repository secret, named YOUTUBE_API_KEY. Never paste the value into chat, source, issues, logs, or screenshots. Repository collaborators who can modify workflows can use its secrets, so keep write access restricted.

The intended production writer validates signed GitHub OIDC tokens against the exact immutable repository/owner IDs, issuer, audience, main branch, approved workflow, allowed events and expiration. Public page viewing must never authorize writes. This repository stores code only. Snapshots belong in the terminal's persistent store, not Git history or Actions artifacts. The terminal must purge snapshots at 29 days, including when YouTube requests fail. Inactive or delayed schedules need operational monitoring.

## Tests

Run npm test with Node 22+. Tests use mock data and require no key. No dependency installation is needed.

## Sources

- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://docs.github.com/en/actions/reference/security/oidc
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

Public data displayed through this service remains subject to YouTube terms, including retention and derived-metric restrictions. Any amendment eligibility must be verified before adding derived metrics or longer storage.
