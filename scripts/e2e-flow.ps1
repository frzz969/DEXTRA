$ts = Get-Date -Format "yyyyMMddHHmmss"
$planId = "pln_e2e_$ts"
$reqId = "req_e2e_$ts"
$actId = "act_e2e_$ts"

Write-Output "===1 CREATE (agent-dev-token) ==="
$body = @{
  request_id = $reqId
  plan_id = $planId
  source = @{ kind = "e2e"; title = "E2E" }
  document = @{ text = "Kirim notulen rapat koordinasi 2026 ke tim" }
  actions = @(@{ action_id = $actId; action_type = "send_email"; params = @{ to = "budi@example.test"; subject = "Notulen E2E" }; source_ref = @{} })
  findings = @()
  validation = @{}
} | ConvertTo-Json -Depth 6 -Compress
$body | Out-File -Encoding utf8 "$env:TEMP\create.json"
Write-Output "PAYLOAD: $body"
$created = curl.exe -s -X POST -H "Authorization: Bearer agent-dev-token" -H "Content-Type: application/json" --data "@$env:TEMP\create.json" http://127.0.0.1:8000/api/v1/office-agent/plans
Write-Output $created

Write-Output "===2 APPROVE (ops-dev-token) ==="
$approveBody = @{ decision = "approved"; reason = "E2E approval"; ttl_minutes = 30 } | ConvertTo-Json -Compress
$approveBody | Out-File -Encoding utf8 "$env:TEMP\approve.json"
$approved = curl.exe -s -X POST -H "Authorization: Bearer ops-dev-token" -H "Content-Type: application/json" --data "@$env:TEMP\approve.json" "http://127.0.0.1:8000/api/v1/office-agent/plans/$planId/actions/$actId/approve"
Write-Output $approved

$mandateId = ($approved | ConvertFrom-Json).mandate_id
Write-Output "MANDATE=$mandateId"

Write-Output "===3 EXECUTE (ops-dev-token) ==="
$execBody = @{ mandate_id = $mandateId; action_id = $actId; action_type = "send_email"; params = @{ to = "budi@example.test"; subject = "Notulen E2E" } } | ConvertTo-Json -Depth 5 -Compress
$execBody | Out-File -Encoding utf8 "$env:TEMP\exec.json"
$executed = curl.exe -s -X POST -H "Authorization: Bearer ops-dev-token" -H "Content-Type: application/json" --data "@$env:TEMP\exec.json" http://127.0.0.1:8000/api/v1/executions
Write-Output $executed

Write-Output "===4 AUDIT VERIFY ==="
curl.exe -s -H "Authorization: Bearer ops-dev-token" http://127.0.0.1:8000/api/v1/audit-events/verify | Write-Output

Write-Output "===5 AUDIT EVENTS (recent) ==="
curl.exe -s -H "Authorization: Bearer ops-dev-token" "http://127.0.0.1:8000/api/v1/audit-events?limit=10&offset=0" | Write-Output

Write-Output "PLAN=$planId MANDATE=$mandateId"
