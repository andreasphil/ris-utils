---
name: Frontend CVE maintenance
description: instructions for fixing CVEs in the frontend, and keeping fixes tidy and relevant
---

...sooo Trivy reports CVEs in the frontend. What should you do?

The easiest case is if the vulnerable dependency is a direct dependency. In that case, change the installed version to the one that's fixed and you should be good to go.

Unfortunately, most of the time the issue will be in a transitive dependency (dependency of a dependency). When that happens:

Bump all dependency versions manually by running `pnpm up`. This will change the lock file, which you'll need to commit. This often fixes the issue. Verify by running `trivy fs .` from the `frontend/` folder.

If that didn't fix it, we have dependencies that still explicitly require the older, vulnerable version. You can override that by adding an entry to the `overrides` section in `pnpm-workspace.yaml`, then running `pnpm install`:

```yaml
overrides:
  some-package: 4.7.11 # pin to the fixed version
```

That should solve all issues of our application and its dependencies. However, it can still happen that the same dependencies are also used in our frontend Docker image, e.g. by npm or pnpm itself. There's not much we can do about that, so we need to ignore them by adding them to the `frontend/.trivyignore`. Verify by building the image and running Trivy on the result:

```bash
# from the frontend folder
docker build .
trivy image <build image ID>
```

## Maintaining pinned versions and ignored CVEs

Pinning versions and ignoring CVEs are hacks. We want to use them as sparingly as possible, and get rid of them again as quickly as we can. How do you know when a pin or ignore is no longer needed?

- Pinned versions: Remove all entries in overrides in the `pnpm-workspace.yml`, then run `trivy fs .` from the `frontend/` folder. Then update the overrides to only contain the vulnerabilities that are still reported.

- Ignored CVEs: Very similar---remove all ignored CVEs, build the image, scan with `trivy image <id>`, and only add the ones that are still being reported back into the file.
