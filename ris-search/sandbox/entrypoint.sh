#!/bin/bash
# Runs as root on every container start. Prepares the VM for Docker, then
# hands over to dockerd, which stays the main process of the container.
set -euo pipefail

# dockerd needs to enable IP forwarding, but /proc/sys is read-only by default
mount -o remount,rw /proc/sys

# volumes are the writable ext4 mounts other than the root filesystem. new
# ones are root-owned, so hand them to the developer. lost+found breaks pnpm
# when it scans node_modules.
for dir in $(findmnt -rn -t ext4 -O rw -o TARGET | grep -vx /); do
  chown developer:developer "$dir"
  rmdir "$dir/lost+found" 2>/dev/null || true
done

# with processes in the root cgroup, dockerd can only create threaded cgroups,
# and container stop fails on those. move everything into a child cgroup and
# enable all controllers, like the docker:dind image does.
mkdir -p /sys/fs/cgroup/init
xargs -rn1 < /sys/fs/cgroup/cgroup.procs > /sys/fs/cgroup/init/cgroup.procs || true
sed -e 's/ / +/g' -e 's/^/+/' < /sys/fs/cgroup/cgroup.controllers \
  > /sys/fs/cgroup/cgroup.subtree_control

# /run lives on the persistent disk, so pid files would survive an unclean
# stop and make dockerd think it's already running. a tmpfs starts empty.
mount -t tmpfs tmpfs /run

exec dockerd --log-level warn
