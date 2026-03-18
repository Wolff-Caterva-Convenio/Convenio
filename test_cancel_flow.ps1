# ====================================
# CONVENIO CANCEL + REFUND TEST
# ====================================

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:9000"

Write-Host "===================================="
Write-Host "CONVENIO CANCEL + REFUND TEST"
Write-Host "===================================="
Write-Host ""

# LOGIN HOST
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


# LOGIN GUEST
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


# SELECT PUBLISHED VENUE
Write-Host "[STEP] Selecting published venue..."

$venues = Invoke-RestMethod -Method GET -Uri "$BASE/venues"
$published = $venues | Where-Object { $_.status -eq "published" -and $_.title -match '^\[TEST\]' } | Select-Object -First 1

if (-not $published) { throw "No published TEST venue found. Create and publish a venue whose title starts with [TEST]." }

$venueId = $published.id
Write-Host "[OK] Using venue $venueId"


# CREATE BOOKING
$checkIn  = (Get-Date).AddMonths(6).ToString("yyyy-MM-dd")
$checkOut = (Get-Date).AddMonths(6).AddDays(1).ToString("yyyy-MM-dd")

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


# CREATE CHECKOUT
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
Write-Host "OPEN THIS URL IN YOUR BROWSER:"
Write-Host $checkoutUrl
Write-Host ""
Write-Host "Use Stripe test card: 4242 4242 4242 4242"
Read-Host "Press ENTER after completing payment"


# WAIT FOR CONFIRMATION
Write-Host "[STEP] Waiting for confirmation..."

Start-Sleep -Seconds 5
$confirmed = $false

for ($i = 0; $i -lt 15; $i++) {

    $myBookings = Invoke-RestMethod `
        -Method GET `
        -Uri "$BASE/venues/my-bookings" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    $current = $myBookings | Where-Object { $_.id -eq $bookingId }

    if ($current.status -eq "CONFIRMED" -or $current.status -eq "COMPLETED") {
        $confirmed = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $confirmed) {
    throw "Booking did not confirm. Status: $($current.status)"
}

Write-Host "[OK] Booking confirmed"


# REQUEST CANCEL
Write-Host "[STEP] Requesting cancellation..."

$cancelRequest = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/payments/bookings/$bookingId/cancel" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

Write-Host "[OK] Cancel request accepted"
Write-Host "Refund ratio: $($cancelRequest.refund_ratio)"
Write-Host "New status: $($cancelRequest.new_status)"


# CONFIRM CANCEL
Write-Host "[STEP] Confirming cancellation..."

$cancelConfirm = Invoke-RestMethod `
    -Method POST `
    -Uri "$BASE/payments/bookings/$bookingId/cancel/confirm" `
    -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

Write-Host "[OK] Refund processed"
Write-Host "Refund amount: $($cancelConfirm.refund_amount)"
Write-Host "Currency: $($cancelConfirm.currency)"
Write-Host "Final status: $($cancelConfirm.new_status)"


# VERIFY NO DOUBLE REFUND
Write-Host "[STEP] Verifying idempotency..."

$doubleWorked = $false

try {
    Invoke-RestMethod `
        -Method POST `
        -Uri "$BASE/payments/bookings/$bookingId/cancel/confirm" `
        -Headers @{ Authorization = "Bearer $GUEST_TOKEN" }

    $doubleWorked = $true
}
catch {
    Write-Host "[OK] Double cancel prevented"
}

if ($doubleWorked) {
    throw "Double refund allowed"
}

Write-Host ""
Write-Host "===================================="
Write-Host "CANCEL + REFUND TEST PASSED"
Write-Host "===================================="