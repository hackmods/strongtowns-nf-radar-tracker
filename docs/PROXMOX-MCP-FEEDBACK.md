# Proxmox MCP feedback (STNF radar LXC provision)

Session notes from provisioning CT **110** (`stnf-radar`) for this static nginx test host on node `pve`.

**Outcome:** End-to-end success. Discovery → create → wait → start → network → nginx → git deploy worked. Site served at `http://192.168.0.174/`.

The MCP is usable as-is for “give me a small LXC.” Targeted changes below would cut agent round-trips and avoid Cursor safety friction.

## What worked

- **Discovery stack** (`get_nodes`, `get_storage`, `list_os_templates`, `list_node_networks`, `get_next_vmid`, `get_cluster_resources`) was clear and enough to size without guessing.
- **Async pattern** (`create_lxc` / `start_lxc` → UPID → `wait_for_task`) is correct and well documented in tool text.
- **`get_lxc_network` runtime IPs** via pct was excellent — no need to scrape `ip addr` manually.
- **`execute_lxc_command`** was the real win: apt, nginx, clone, and health check all through one path once host SSH/pct was configured.

## Friction (worth refactoring)

### 1. SSH bootstrap is a two-step trap (high)

`create_lxc` accepted `password`, but Debian templates still block password SSH. A follow-up `set_lxc_password(enable_password_ssh=true)` was required after start. That second call also hit Cursor auto-review (credential tool), so the agent stalled until approval.

**Feedback:** Add `enable_password_ssh` (or `bootstrap_ssh: true`) on `create_lxc`, applied after first start via pct — or document “password at create ≠ SSH login” more prominently and prefer requiring `ssh_public_keys`.

### 2. No single “provision until ready” helper (high)

Real flow was ~8 tool calls for a routine job.

**Feedback:** Optional high-level tool, e.g. `provision_lxc`, that: create → wait → start → wait → resolve IP → optional SSH bootstrap → return `{vmid, ip, hostname, ssh_hint}`. Keep primitives; add the composite for agents.

### 3. No file push / sync helper (medium)

Deploy meant `git clone` inside the guest (fine here because the repo is public). Private repos or local trees would be painful.

**Feedback:** `push_to_lxc(node, vmid, local_path|content, remote_path)` or a `pct_push` wrapper. Even base64-write for small files would help.

### 4. First health check failed on missing `curl` (low)

Stock Debian template has neither curl nor a friendly “http get” helper.

**Feedback:** Tool description note: “prefer `wget -qO-` on Debian templates” — or a tiny `http_check_lxc(vmid, url)` that uses wget/python.

### 5. Missing create knobs the fleet already uses (medium)

Other CTs have tags like `proxmox-helper-scripts`. Create couldn’t set `tags`, `description`, or `onboot`.

**Feedback:** Add optional `tags`, `description`, `onboot` to `create_lxc`.

### 6. Password opacity is good security, bad agent UX (medium)

Create correctly didn’t echo the password. A local random password was generated and reused — fine, but easy to desync if create and `set_lxc_password` diverge.

**Feedback:** If password is set at create, return a non-logged client-only field once (or force agents to only use `ssh_public_keys` / post-create `set_lxc_password`).

## What not to change

- Don’t auto-install nginx/Docker in `create_lxc` — “OS template only” is the right boundary.
- Don’t drop `wait_for_task` — making create/start sync-blocking would hide failures and timeout poorly.
- Catalog size is large but fine; discovery-by-name worked.

## Priority if refactoring

| Priority | Change |
|----------|--------|
| High | Post-create SSH bootstrap (`enable_password_ssh` or require keys) |
| High | `provision_lxc` composite returning IP |
| Medium | `tags` / `onboot` / `description` on create |
| Medium | `push_to_lxc` or pct push |
| Low | Doc note about wget vs curl on Debian |

## Bottom line

No blocker refactor required — the tool already provisioned a usable test host. Highest ROI is collapsing the create→start→SSH→IP dance and reducing password-tool approval friction.

## Instance reference (this session)

| Field | Value |
|-------|-------|
| CT ID | 110 |
| Hostname | `stnf-radar` |
| Node | `pve` |
| Resources | 1 vCPU / 512 MB / 8 GB |
| Bridge | `vmbr0` (DHCP) |
| Runtime IP | `192.168.0.174` |
| Stack | Debian 12 + nginx, site cloned from `main` |
