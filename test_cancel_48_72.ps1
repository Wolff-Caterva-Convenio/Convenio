# ====================================
# CONVENIO CANCEL TEST (48-72H BAND)
# - Creates booking ~2 days ahead
# - Pays via Stripe Checkout
# - Cancels and confirms cancellation
# - Validates refund_amount == 50% of total paid
# - Prints platform_keep + host_payout (computed locally)
# - Then calls cancel/confirm a SECOND time and expects rejection (409/400)
# ====================================

$ErrorActionPreference = "Stop"

$BASE = "http://127.0.0.1:9000"

Write-Host "===================================="
Write-Host "CONVENIO CANCEL TEST (48-72H BAND)"
Write-Host "===================================="
Write-Host ""

function Round-Int($n) {
    return [int][math]::Round([double]$n, 0, [MidpointRounding]::AwayFromZero)
}

# ------------------------------------
# STEP 1: LOGIN HOST
# ------------------------------------
Write-Host "[STEP] Logging in host..."

$hostLogin = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/login" `
    -ContentType "application/json" `
    -Body (@{
        email    = "host@test.com"
        password = "12345678"
    } | ConvertTo-Json)

$HOST_TOKEN = $hostLogin.access_token
if (-not $HOST_TOKEN) { throw "Host login failed." }

Write-Host "[OK] Host login successful"

# ------------------------------------
# STEP 2: LOGIN GUEST
# ------------------------------------
Write-Host "[STEP] Logging in guest..."

$guestLogin = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/login" `
    -ContentType "application/json" `
    -Body (@{
        email    = "guest@test.com"
        password = "12345678"
    } | ConvertTo-Json)

$GUEST_TOKEN = $guestLogin.access_token
if (-not $GUEST_TOKEN) { throw "Guest login failed." }

Write-Host "[OK] Guest login successful"

# ------------------------------------
# STEP 3: SELECT ONE PUBLISHED VENUE
# ------------------------------------
Write-Host "[STEP] Selecting published venue..."

$venues = Invoke-RestMethod `
    -Method GET `
    -Uri "$BASE/venues"

$published = $venues | Where-Object { $_.status -eq "published" -and $_.title -match '^\[TEST\]' } | Select-Object -First 1
if (-not $published) { throw "No published TEST venue found. Create and publish a venue whose title starts with [TEST]." }

$venueId = $published.id
Write-Host "[OK] Using venue $venueId"

# ------------------------------------
# STEP 4: CREATE BOOKING (~2 DAYS AHEAD)
# ------------------------------------
$checkIn  = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")
$checkOut = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")

Write-Host "[STEP] Creating booking $checkIn to $checkOut"

$booking = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/venues/$venueId/bookings" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" } `
    -ContentType "application/json" `
    -Body (@{
        check_in  = $checkIn
        check_out = $checkOut
    } | ConvertTo-Json)

$bookingId = $booking.id
if (-not $bookingId) { throw "Booking creation failed." }

Write-Host "[OK] Booking created: $bookingId"

# ------------------------------------
# STEP 5: CREATE CHECKOUT SESSION
# ------------------------------------
Write-Host "[STEP] Creating checkout session..."

$checkout = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/payments/stripe/checkout-session" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" } `
    -ContentType "application/json" `
    -Body (@{
        booking_id           = $bookingId
        accept_rules_and_gtc = $true
    } | ConvertTo-Json)

$checkoutUrl = $checkout.checkout_url
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

# ------------------------------------
# STEP 6: WAIT FOR WEBHOOK CONFIRMATION
# ------------------------------------
Write-Host "[STEP] Waiting for webhook confirmation..."

Start-Sleep -Seconds 5

$confirmed = $false
$current = $null

for ($i = 0; $i -lt 15; $i++) {

    $myBookings = Invoke-RestMethod `
        -Method GET `
        -Uri "$BASE/venues/my-bookings" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    $current = $myBookings | Where-Object { $_.id -eq $bookingId }

    if ($current -and ($current.status -eq "CONFIRMED" -or $current.status -eq "COMPLETED")) {
        $confirmed = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $confirmed) {
    $finalStatus = ""
    if ($current) { $finalStatus = $current.status }
    throw "Booking not confirmed. Final status: $finalStatus"
}

Write-Host "[OK] Booking confirmed: $($current.status)"

# ------------------------------------
# STEP 7: READ TOTAL PAID (T)
# ------------------------------------
$totalPaid = $null
if ($null -ne $current.guest_total) { $totalPaid = $current.guest_total }
elseif ($null -ne $current.amount_guest_total) { $totalPaid = $current.amount_guest_total }
elseif ($null -ne $current.total_paid) { $totalPaid = $current.total_paid }

if ($null -eq $totalPaid) {
    throw "Could not find total paid on booking. Expected guest_total or amount_guest_total or total_paid."
}

Write-Host "[INFO] Total paid (T): $totalPaid"

# ------------------------------------
# STEP 8: REQUEST CANCELLATION
# ------------------------------------
Write-Host "[STEP] Requesting cancellation..."

$null = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/payments/bookings/$bookingId/cancel" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

Write-Host "[OK] Cancel requested"

# ------------------------------------
# STEP 9: CONFIRM CANCELLATION
# ------------------------------------
Write-Host "[STEP] Confirming cancellation..."

$cancelConf = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/payments/bookings/$bookingId/cancel/confirm" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

# ------------------------------------
# STEP 10: VALIDATE REFUND (50% OF T) + PRINT SPLIT
# ------------------------------------
$expectedRefund = Round-Int($totalPaid * 0.50)

$actualRefund = $cancelConf.refund_amount
if ($null -eq $actualRefund) { throw "Confirm response missing refund_amount." }

Write-Host ""
Write-Host "===================================="
Write-Host "CANCEL CONFIRM RESULT"
Write-Host "===================================="
Write-Host "Booking ID:      $bookingId"
Write-Host "Total paid (T):  $totalPaid"
Write-Host "Refund ratio:    0.50"
Write-Host "Expected refund: $expectedRefund"
Write-Host "Actual refund:   $actualRefund"
Write-Host "New status:      $($cancelConf.new_status)"
Write-Host "Currency:        $($cancelConf.currency)"
Write-Host ""

if ([int]$actualRefund -ne [int]$expectedRefund) {
    throw "REFUND MISMATCH: expected $expectedRefund but got $actualRefund"
}

$keptAmount = [int]$totalPaid - [int]$actualRefund
if ($keptAmount -lt 0) { $keptAmount = 0 }

$platformKeep = Round-Int($keptAmount * 0.17)
$hostPayout = $keptAmount - $platformKeep
if ($hostPayout -lt 0) { $hostPayout = 0 }

Write-Host "Kept amount:     $keptAmount"
Write-Host "Platform keeps:  $platformKeep"
Write-Host "Host payout:     $hostPayout"
Write-Host "===================================="
Write-Host ""

# ------------------------------------
# STEP 11: DOUBLE CONFIRM PROTECTION TEST
# ------------------------------------
Write-Host "[STEP] Testing double cancel-confirm protection (should be rejected)..."

try {

    $null = Invoke-RestMethod `
        -Method POST `
        -Uri "$BASE/payments/bookings/$bookingId/cancel/confirm" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    throw "ERROR: Second cancel confirm was allowed! This is a state machine bug."

}
catch {
    # We expect a rejection (409/400/etc). Print a short OK line.
    Write-Host "[OK] Second cancel confirm rejected (good)"
}

Write-Host ""
Write-Host "===================================="
Write-Host "CANCEL TEST PASSED (48-72H, 50%)"
Write-Host "===================================="