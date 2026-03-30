$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:9000"

# --- HELPER FUNCTIONS ---

function Get-Tokens {
    Write-Host "[INIT] Authenticating..."
    $h = Invoke-RestMethod -Method POST -Uri "$BASE/login" -ContentType "application/json" -Body (@{email="host@test.com"; password="12345678"} | ConvertTo-Json)
    $g = Invoke-RestMethod -Method POST -Uri "$BASE/login" -ContentType "application/json" -Body (@{email="guest@test.com"; password="12345678"} | ConvertTo-Json)
    return @{ host = $h.access_token; guest = $g.access_token }
}

function Get-TestVenue {
    $venues = Invoke-RestMethod -Method GET -Uri "$BASE/venues"
    $v = $venues | Where-Object { $_.status -eq "published" -and $_.title -match '^\[TEST\]' } | Select-Object -First 1
    if (-not $v) { throw "No [TEST] venue found." }
    return $v.id
}

function Automate-Payment($url) {
    Write-Host "[AUTO] Processing payment via Firefox..."
    node pay.cjs "$url"
    if ($LASTEXITCODE -ne 0) { throw "Payment automation failed." }
}

function Wait-For-Status($token, $bookingId, $targetStatuses) {
    Write-Host "[WAIT] Waiting for status: $($targetStatuses -join ' or ')..."
    for ($i = 0; $i -lt 15; $i++) {
        $bookings = Invoke-RestMethod -Uri "$BASE/venues/my-bookings" -Headers @{Authorization="Bearer $token"}
        $current = $bookings | Where-Object { $_.id -eq $bookingId }
        if ($current.status -in $targetStatuses) { return $current }
        Start-Sleep -Seconds 2
    }
    throw "Timeout waiting for status on $bookingId"
}

# --- TEST SUITES ---

function Run-E2E-Standard($tokens, $venueId) {
    Write-Host "`n>>> RUNNING: STANDARD E2E TEST"
    
    # Restored your Get-Random logic to avoid 409 conflicts
    $randomOffset = Get-Random -Minimum 30 -Maximum 365
    $checkIn = (Get-Date).AddDays($randomOffset).ToString("yyyy-MM-dd")
    $checkOut = (Get-Date).AddDays($randomOffset + 1).ToString("yyyy-MM-dd")
    Write-Host "    Trying dates: $checkIn to $checkOut"

    $res = Invoke-RestMethod -Method POST -Uri "$BASE/venues/$venueId/bookings" -Headers @{Authorization="Bearer $($tokens.guest)"} -ContentType "application/json" -Body (@{check_in=$checkIn; check_out=$checkOut} | ConvertTo-Json)
    
    $checkout = Invoke-RestMethod -Method POST -Uri "$BASE/payments/stripe/checkout-session" -Headers @{Authorization="Bearer $($tokens.guest)"} -ContentType "application/json" -Body (@{booking_id=$res.id; accept_rules_and_gtc=$true} | ConvertTo-Json)
    
    Automate-Payment $checkout.checkout_url
    Wait-For-Status $tokens.guest $res.id @("CONFIRMED", "COMPLETED") | Out-Null
    Write-Host "[PASS] Standard Booking Confirmed"
}

function Run-Completion-Test($tokens, $venueId) {
    Write-Host "`n>>> RUNNING: COMPLETION TEST (PAST DATES)"
    
    $res = $null
    # Restored your 10-attempt retry loop for past dates
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        $daysBack = 40 + (Get-Random -Minimum 0 -Maximum 30)
        $checkIn  = (Get-Date).AddDays(-1 * $daysBack).ToString("yyyy-MM-dd")
        $checkOut = (Get-Date $checkIn).AddDays(1).ToString("yyyy-MM-dd")
        Write-Host "    [TRY $attempt] $checkIn to $checkOut"

        try {
            $res = Invoke-RestMethod -Method POST -Uri "$BASE/venues/$venueId/bookings" -Headers @{Authorization="Bearer $($tokens.guest)"} -ContentType "application/json" -Body (@{check_in=$checkIn; check_out=$checkOut} | ConvertTo-Json)
            break
        } catch {
            if ($_.Exception.Message -match "409") { continue } # Skip on conflict and try new random dates
            throw
        }
    }
    if (-not $res) { throw "Could not find open past dates after 10 attempts." }

    $checkout = Invoke-RestMethod -Method POST -Uri "$BASE/payments/stripe/checkout-session" -Headers @{Authorization="Bearer $($tokens.guest)"} -ContentType "application/json" -Body (@{booking_id=$res.id; accept_rules_and_gtc=$true} | ConvertTo-Json)
    
    Automate-Payment $checkout.checkout_url
    Wait-For-Status $tokens.guest $res.id @("COMPLETED") | Out-Null
    Write-Host "[PASS] Past-date booking auto-completed"
}

function Run-Cancellation-Test($tokens, $venueId) {
    Write-Host "`n>>> RUNNING: CANCELLATION TEST (<48H BAND)"
    
    # We can use tomorrow because the test cancels it at the end, freeing up the slot again
    $checkIn = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
    $checkOut = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")
    Write-Host "    Trying dates: $checkIn to $checkOut"

    $res = Invoke-RestMethod -Method POST -Uri "$BASE/venues/$venueId/bookings" -Headers @{Authorization="Bearer $($tokens.guest)"} -ContentType "application/json" -Body (@{check_in=$checkIn; check_out=$checkOut} | ConvertTo-Json)
    
    $checkout = Invoke-RestMethod -Method POST -Uri "$BASE/payments/stripe/checkout-session" -Headers @{Authorization="Bearer $($tokens.guest)"} -ContentType "application/json" -Body (@{booking_id=$res.id; accept_rules_and_gtc=$true} | ConvertTo-Json)
    
    Automate-Payment $checkout.checkout_url
    Wait-For-Status $tokens.guest $res.id @("CONFIRMED") | Out-Null
    
    Invoke-RestMethod -Method POST -Uri "$BASE/payments/bookings/$($res.id)/cancel" -Headers @{Authorization="Bearer $($tokens.guest)"} | Out-Null
    $result = Invoke-RestMethod -Method POST -Uri "$BASE/payments/bookings/$($res.id)/cancel/confirm" -Headers @{Authorization="Bearer $($tokens.guest)"}
    
    if ($result.new_status -ne "CANCELLED") { throw "Cancel failed" }
    Write-Host "[PASS] Cancellation processed with status: $($result.new_status)"
}

# --- EXECUTION ---

try {
    $tokens = Get-Tokens
    $venueId = Get-TestVenue
    
    Run-E2E-Standard $tokens $venueId
    Run-Completion-Test $tokens $venueId
    Run-Cancellation-Test $tokens $venueId
    
    Write-Host "`n===================================="
    Write-Host "ALL SUITES PASSED SUCCESSFULLY"
    Write-Host "===================================="
} catch {
    Write-Warning "Test Failure: $($_.Exception.Message)"
}