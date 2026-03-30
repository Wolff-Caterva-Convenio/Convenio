# ====================================
# CONVENIO COMPLETION TEST
# Verifies CONFIRMED -> COMPLETED after check_out is in the past.
# ====================================

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:9000"

Write-Host "===================================="
Write-Host "CONVENIO COMPLETION TEST"
Write-Host "===================================="
Write-Host ""

# STEP 1: LOGIN HOST
Write-Host "[STEP] Logging in host..."
$hostLogin = Invoke-RestMethod -Method POST -Uri "$BASE/login" -ContentType "application/json" `
    -Body (@{ email="host@test.com"; password="12345678" } | ConvertTo-Json)
$HOST_TOKEN = $hostLogin.access_token
if (-not $HOST_TOKEN) { throw "Host login failed." }
Write-Host "[OK] Host login successful"

# STEP 2: LOGIN GUEST
Write-Host "[STEP] Logging in guest..."
$guestLogin = Invoke-RestMethod -Method POST -Uri "$BASE/login" -ContentType "application/json" `
    -Body (@{ email="guest@test.com"; password="12345678" } | ConvertTo-Json)
$GUEST_TOKEN = $guestLogin.access_token
if (-not $GUEST_TOKEN) { throw "Guest login failed." }
Write-Host "[OK] Guest login successful"

# STEP 3: SELECT VENUE
Write-Host "[STEP] Selecting published venue..."
$venues = Invoke-RestMethod -Method GET -Uri "$BASE/venues"
$published = $venues | Where-Object { $_.status -eq "published" -and $_.title -match '^\[TEST\]' } | Select-Object -First 1
if (-not $published) { throw "No published TEST venue found. Create and publish a venue whose title starts with [TEST]." }
$venueId = $published.id
Write-Host "[OK] Using venue $venueId"

# STEP 4: CREATE BOOKING (PAST DATES)
Write-Host "[STEP] Creating a booking with past dates (to trigger COMPLETED)..."

$bookingId = $null
$checkInStr = $null
$checkOutStr = $null

for ($attempt = 1; $attempt -le 10; $attempt++) {

    $daysBack = 40 + (Get-Random -Minimum 0 -Maximum 30)
    $checkInStr  = (Get-Date).AddDays(-1 * $daysBack).ToString("yyyy-MM-dd")
    $checkOutStr = (Get-Date $checkInStr).AddDays(1).ToString("yyyy-MM-dd")

    Write-Host "  [TRY $attempt] $checkInStr to $checkOutStr"

    try {
        $booking = Invoke-RestMethod -Method POST `
            -Uri "$BASE/venues/$venueId/bookings" `
            -Headers @{ Authorization = "Bearer $GUEST_TOKEN" } `
            -ContentType "application/json" `
            -Body (@{ check_in=$checkInStr; check_out=$checkOutStr } | ConvertTo-Json)

        $bookingId = $booking.id
        break
    }
    catch {
        if ($_.Exception.Message -match "Dates already booked") { continue }
        throw
    }
}

if (-not $bookingId) { throw "Could not create a past-date booking after 10 attempts." }
Write-Host "[OK] Booking created: $bookingId"

# STEP 5: CREATE CHECKOUT
Write-Host "[STEP] Creating checkout session..."
$checkoutResp = Invoke-RestMethod -Method POST `
    -Uri "$BASE/payments/stripe/checkout-session" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" } `
    -ContentType "application/json" `
    -Body (@{ booking_id=$bookingId; accept_rules_and_gtc=$true } | ConvertTo-Json)

$checkoutUrl = $checkoutResp.checkout_url
if (-not $checkoutUrl) { throw "Checkout session failed." }

Write-Host "[OK] Checkout session created"
Write-Host ""
Write-Host "===================================="
Write-Host "OPEN THIS URL IN YOUR BROWSER:"
Write-Host "$checkoutUrl"
Write-Host "===================================="
Write-Host ""
Write-Host "Use Stripe test card: 4242 4242 4242 4242"
Write-Host ""
Read-Host "Press ENTER after completing payment"

# STEP 6: WAIT FOR WEBHOOK CONFIRMATION
Write-Host "[STEP] Waiting for webhook confirmation..."
Start-Sleep -Seconds 5

$current = $null
$seenConfirmedOrCompleted = $false

for ($i = 0; $i -lt 15; $i++) {

    $myBookings = Invoke-RestMethod -Method GET `
        -Uri "$BASE/venues/me" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    $current = $myBookings | Where-Object { $_.id -eq $bookingId }

    if ($current -and ($current.status -eq "CONFIRMED" -or $current.status -eq "COMPLETED")) {
        $seenConfirmedOrCompleted = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $seenConfirmedOrCompleted) {
    $finalStatus = ""
    if ($current) { $finalStatus = $current.status }
    throw "Booking not confirmed by webhook. Final status: $finalStatus"
}

Write-Host "[OK] Booking after payment: $($current.status)"

# STEP 7: ASSERT COMPLETION
Write-Host "[STEP] Waiting for CONFIRMED -> COMPLETED..."

$completed = $false

for ($i = 0; $i -lt 15; $i++) {

    $myBookings = Invoke-RestMethod -Method GET `
        -Uri "$BASE/venues/me" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    $current = $myBookings | Where-Object { $_.id -eq $bookingId }

    if ($current -and $current.status -eq "COMPLETED") {
        $completed = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $completed) {
    $finalStatus = ""
    if ($current) { $finalStatus = $current.status }
    throw "Completion failed. Expected COMPLETED but got: $finalStatus"
}

Write-Host ""
Write-Host "===================================="
Write-Host "COMPLETION TEST PASSED"
Write-Host "===================================="
Write-Host "Booking ID: $bookingId"
Write-Host "Dates:      $checkInStr to $checkOutStr"
Write-Host "Final:      $($current.status)"
Write-Host "===================================="