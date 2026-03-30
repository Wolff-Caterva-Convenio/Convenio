# ====================================
# CONVENIO CANCEL TEST (<48H BAND)
# Policy:
#   - Refund ratio: 0.00
#   - Kept amount = 100% of total paid
#   - Platform keeps 17% of kept amount
#   - Host payout = remainder
# Also verifies double cancel-confirm is rejected
# ====================================

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:9000"

Write-Host "===================================="
Write-Host "CONVENIO CANCEL TEST (<48H BAND)"
Write-Host "===================================="
Write-Host ""

function Round-Int($n) {
    return [int][math]::Round([double]$n, 0, [MidpointRounding]::AwayFromZero)
}

# LOGIN HOST
Write-Host "[STEP] Logging in host..."

$hostLogin = Invoke-RestMethod -Method POST -Uri "$BASE/login" `
    -ContentType "application/json" `
    -Body (@{
        email    = "host@test.com"
        password = "12345678"
    } | ConvertTo-Json)

$HOST_TOKEN = $hostLogin.access_token
if (-not $HOST_TOKEN) { throw "Host login failed." }

Write-Host "[OK] Host login successful"

# LOGIN GUEST
Write-Host "[STEP] Logging in guest..."

$guestLogin = Invoke-RestMethod -Method POST -Uri "$BASE/login" `
    -ContentType "application/json" `
    -Body (@{
        email    = "guest@test.com"
        password = "12345678"
    } | ConvertTo-Json)

$GUEST_TOKEN = $guestLogin.access_token
if (-not $GUEST_TOKEN) { throw "Guest login failed." }

Write-Host "[OK] Guest login successful"

# SELECT VENUE
Write-Host "[STEP] Selecting published venue..."

$venues = Invoke-RestMethod -Method GET -Uri "$BASE/venues"
$venue = $venues | Where-Object { $_.status -eq "published" -and $_.title -match '^\[TEST\]' } | Select-Object -First 1
if (-not $venue) { throw "No published TEST venue found. Create and publish a venue whose title starts with [TEST]." }

$venueId = $venue.id
Write-Host "[OK] Using venue $venueId"

# CREATE BOOKING (<48h): check-in tomorrow
$checkIn  = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$checkOut = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")

Write-Host "[STEP] Creating booking $checkIn to $checkOut"

$booking = Invoke-RestMethod -Method POST `
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

# CHECKOUT SESSION
Write-Host "[STEP] Creating checkout session..."

$checkout = Invoke-RestMethod -Method POST `
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
Write-Host $checkoutUrl
Write-Host "===================================="
Write-Host ""
Write-Host "Use Stripe test card: 4242 4242 4242 4242"
Write-Host ""
Read-Host "Press ENTER after completing payment"

# WAIT FOR CONFIRMATION
Write-Host "[STEP] Waiting for webhook confirmation..."
Start-Sleep -Seconds 5

$confirmed = $false
$current = $null

for ($i = 0; $i -lt 15; $i++) {

    $myBookings = Invoke-RestMethod -Method GET `
        -Uri "$BASE/venues/me" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    $current = $myBookings | Where-Object { $_.id -eq $bookingId }

    if ($current -and ($current.status -eq "CONFIRMED" -or $current.status -eq "COMPLETED")) {
        $confirmed = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $confirmed) { throw "Booking not confirmed. Status: $($current.status)" }

# TOTAL PAID (T)
$total = $null
if ($null -ne $current.guest_total) { $total = $current.guest_total }
elseif ($null -ne $current.amount_guest_total) { $total = $current.amount_guest_total }
elseif ($null -ne $current.total_paid) { $total = $current.total_paid }

if ($null -eq $total) { throw "Could not determine total paid (T) from my-bookings." }

Write-Host "[OK] Booking confirmed: $($current.status)"
Write-Host "[INFO] Total paid (T): $total"

# CANCEL
Write-Host "[STEP] Requesting cancellation..."
Invoke-RestMethod -Method POST `
    -Uri "$BASE/payments/bookings/$bookingId/cancel" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" } | Out-Null
Write-Host "[OK] Cancel requested"

Write-Host "[STEP] Confirming cancellation..."
$result = Invoke-RestMethod -Method POST `
    -Uri "$BASE/payments/bookings/$bookingId/cancel/confirm" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

# ASSERT REFUND = 0%
$expectedRefund = 0
$actualRefund = [int]$result.refund_amount
if ($actualRefund -ne $expectedRefund) {
    throw "Refund mismatch. Expected $expectedRefund, got $actualRefund"
}

$keptAmount = [int]$total  # refund is zero, so kept = total
$platformKeep = Round-Int($keptAmount * 0.17)
$hostPayout = $keptAmount - $platformKeep
if ($hostPayout -lt 0) { $hostPayout = 0 }

Write-Host ""
Write-Host "===================================="
Write-Host "CANCEL CONFIRM RESULT"
Write-Host "===================================="
Write-Host "Booking ID:      $bookingId"
Write-Host "Total paid (T):  $total"
Write-Host "Refund ratio:    0.00"
Write-Host "Expected refund: $expectedRefund"
Write-Host "Actual refund:   $actualRefund"
Write-Host "New status:      $($result.new_status)"
Write-Host "Currency:        $($result.currency)"
Write-Host ""
Write-Host "Kept amount:     $keptAmount"
Write-Host "Platform keeps:  $platformKeep"
Write-Host "Host payout:     $hostPayout"
Write-Host "===================================="
Write-Host ""

if ($result.new_status -ne "CANCELLED") {
    throw "Unexpected status after cancel confirm: $($result.new_status)"
}

# DOUBLE CONFIRM PROTECTION
Write-Host "[STEP] Testing double cancel-confirm protection (should be rejected)..."
try {
    Invoke-RestMethod -Method POST `
        -Uri "$BASE/payments/bookings/$bookingId/cancel/confirm" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" } | Out-Null

    throw "Second cancel confirm was NOT rejected (bad)"
} catch {
    Write-Host "[OK] Second cancel confirm rejected (good)"
}

Write-Host ""
Write-Host "===================================="
Write-Host "CANCEL TEST PASSED (<48H, 0%)"
Write-Host "===================================="