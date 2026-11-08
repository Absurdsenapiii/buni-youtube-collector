# BMH public YouTube collector

Active public-data integration for https://terminal.alignmentlab.com.
Only @bunimediahub is collected. Sidequest is paused.

The collector reads official YouTube Data API v3 public channel/video counts. It does not read private Analytics, comment text, or viewer identities. Malfoid titles are review candidates, not an approved roster. No derived engagement scores, summed views, growth calculations, or population ratios are emitted.

## Status

Enabled on 3 November 2026. The first collection succeeded at 07:17:55 UTC (15:17:55 Singapore). From 8 November 2026, the single daily trigger is scheduled for 02:55 Asia/Singapore (18:55 UTC on the previous UTC date), six hours earlier as an experiment after repeated scheduling delays. This does not guarantee a 9 AM update: GitHub may run promptly at 02:55 or later, and the delay may change. Snapshots retain their actual collection timestamps and Singapore dates; an early snapshot may remain the day's snapshot. Manual runs remain supported. Verify the next scheduled run and its saved snapshot before judging the new timing. COLLECTOR_ENABLED=true is the owner-approved activation gate. Signed, repository-restricted GitHub OIDC writes were tested end-to-end. Sidequest remains paused.

## Private configuration

The owner enters the existing restricted YouTube Data API v3 key directly in GitHub repository Settings > Secrets and variables > Actions > New repository secret, named YOUTUBE_API_KEY. Never paste the value into chat, source, issues, logs, or screenshots. Repository collaborators who can modify workflows can use its secrets, so keep write access restricted.

The production writer validates signed GitHub OIDC tokens against the exact immutable repository/owner IDs, issuer, audience, main branch, approved workflow, allowed events and expiration. Public page viewing must never authorize writes. This repository stores code only. Snapshots belong in the terminal's persistent store, not Git history or Actions artifacts. The terminal purges snapshots older than 29 days on each collector run, including when YouTube requests fail. Inactive or delayed schedules need operational monitoring.

## Tests

Run npm test with Node 22+. Tests use mock data and require no key. No dependency installation is needed.

## Sources

- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://docs.github.com/en/actions/reference/security/oidc
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

Public data displayed through this service remains subject to YouTube terms, including retention and derived-metric restrictions. Any amendment eligibility must be verified before adding derived metrics or longer storage.
