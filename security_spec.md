# Security Specification: Munsi Store FMCG DSR Distribution System

## 1. Data Invariants & Authorization Boundaries

1. **Role Hierarchies (Admin, SR, DSR)**:
   - **Admin**: Has absolute control over user role assignment (`admin`, `sr`, `dsr`), route territory assignments, product catalog creation & wholesale pricing, shop approvals, and order cancellations.
   - **SR (Sales Representative)**: Can manage shops in their assigned routes/territories, book orders, review route order history, track due collections, and view product inventory. Cannot modify wholesale unit purchase cost or elevate user roles.
   - **DSR (Dealer Sales Representative)**: Can book shop orders, print/issue memos, record due collections, and update delivery status. Cannot delete shops, modify master products, or alter other users' profiles.
   - Bootstrapped initial admin email: `ahmedmdforid39@gmail.com`.

2. **Shops & Due Invariants**:
   - Every shop record must have a non-empty name, phone, valid routeArea, and positive or zero `previousDue`.
   - Creation & updates are permitted to authenticated team members (Admin, SR, DSR).

3. **Products & Inventory Invariants**:
   - Only Admins can create or modify master product wholesale pricing and cost parameters.
   - Stock adjustments during sales order placement or delivery fulfillment can be executed by authenticated sales reps (Admin, SR, DSR) with positive integer stock bounds.

4. **Orders & Invoices**:
   - Order memos must contain valid shop identification, positive or zero monetary totals, and immutable memo numbers.
   - Order cancellation or price alteration is restricted to Admin or the booking agent.

5. **Due Collections**:
   - Collection records are append-only audit entries containing shopId, amount, date, and valid paymentMethod (`CASH`, `BKASH`, `NAGAD`).

---

## 2. The "Dirty Dozen" Vulnerability Test Payloads

1. **Unauthenticated Read on Shop Records**:
   - Payload: GET `/shops/shop-1` without `request.auth`.
   - Expected: PERMISSION_DENIED.

2. **DSR Role Self-Promotion to Admin**:
   - Payload: UPDATE `/users/user-dsr-1` with `role: "admin"`.
   - Expected: PERMISSION_DENIED (only existing Admin can change roles).

3. **Spoofed Admin Email without Verification**:
   - Payload: WRITE `/admins/admin-spoof` with unverified email.
   - Expected: PERMISSION_DENIED.

4. **Malicious Negative Product Pricing**:
   - Payload: CREATE `/products/malicious-oil` with `unitPrice: -500`.
   - Expected: PERMISSION_DENIED.

5. **Arbitrary Field Injection in Order (Shadow Field)**:
   - Payload: CREATE `/orders/ord-test` with extra unlisted field `isAdminBypass: true`.
   - Expected: PERMISSION_DENIED.

6. **ID Poisoning with 2KB String**:
   - Payload: GET `/orders/` + 'a'.repeat(2048).
   - Expected: PERMISSION_DENIED via `isValidId()`.

7. **DSR Deleting a Retailer Shop**:
   - Payload: DELETE `/shops/shop-important` by user with role `dsr`.
   - Expected: PERMISSION_DENIED (only Admin can delete shops).

8. **Order Total Manipulation (Mismatching Net Total vs Items)**:
   - Payload: CREATE `/orders/ord-tampered` with `netTotal: -9999`.
   - Expected: PERMISSION_DENIED.

9. **Terminal Status Bypass on Delivered Order**:
   - Payload: UPDATE `/orders/ord-delivered` altering paymentMethod after final delivery.
   - Expected: PERMISSION_DENIED unless Admin.

10. **Due Collection with Negative Amount (Money Extraction)**:
    - Payload: CREATE `/dueCollections/col-theft` with `amount: -5000`.
    - Expected: PERMISSION_DENIED.

11. **DSR Attempting Wholesale Cost Price Edit**:
    - Payload: UPDATE `/products/prod-1` altering `costPrice` and `unitPrice`.
    - Expected: PERMISSION_DENIED.

12. **Blanket Query Scraping without Authentication**:
    - Payload: LIST `/orders` by unauthenticated client.
    - Expected: PERMISSION_DENIED.
