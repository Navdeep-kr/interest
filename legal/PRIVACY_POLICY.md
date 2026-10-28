# Interest Platform Privacy Policy
**Last Updated: October 12, 2026 | Effective Date: October 12, 2026 | Version: 2.4**

---

## 1. Foundational Commitment: The Zero-Location Architecture

**Interest** is built on an architectural guarantee: **We do not track, derive, or store your geographic location.**

Unlike conventional social networks and recommendation systems:
1. **Zero GPS & Proximity**: We never ask for or ingest GPS coordinates, Wi-Fi BSSID identifiers, or cellular tower telemetry.
2. **Zero IP Geolocation**: Our edge gateway strictly strips IP headers before payloads reach our recommendation engines, vector stores, and analytics databases. We do not index what country, state, or city you reside in.
3. **Pure Semantic Discovery**: All content recommendations are driven exclusively by your declared topic affinities and behavioral watch-time signals across our 3-tier interest taxonomy (Categories $\to$ Topics $\to$ Deep Niches).

---

## 2. Global Compliance Frameworks

This Privacy Policy complies with:
- **European Union / UK**: General Data Protection Regulation (GDPR) & UK GDPR.
- **India**: Digital Personal Data Protection Act, 2023 (DPDP Act) & Information Technology Rules, 2021.
- **United States**: California Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA) & Children's Online Privacy Protection Act (COPPA).

---

## 3. Data We Collect and Why

| Category of Data | Specific Data Elements | Legal Basis / Purpose |
| :--- | :--- | :--- |
| **Account Identity** | Username, Display Name, Email, Password Hash, Avatar URL, Bio | Contractual Necessity (Providing your account) |
| **Age Verification** | Birth Year (Used solely to evaluate minor status $\ge 13$ and $\ge 18$) | Legal Obligation (COPPA, DPDP child protection) |
| **Interest Affinity Vectors** | Selected topics, 512-dimension unit vector embeddings, affinity weights (0.1 to 5.0) | Legitimate Interest & Explicit Consent (Feed personalization) |
| **Engagement Telemetry** | Reel watch duration, loop counts, likes, saves, shares, quick skips ($<1.5$s) | Legitimate Interest (Feed quality & creator payouts) |
| **Creator Monetization** | Payout details (Stripe Connect / Razorpay Route), W-9/TDS tax identification | Legal Obligation (Tax withholding & disbursement) |
| **User Consents** | Granular consent timestamps, consent versions, withdrawal records | Legal Obligation (GDPR Art. 7, DPDP Sec. 6) |

---

## 4. Your Rights under GDPR & DPDP Act

### 4.1 Right to Access & Data Portability (GDPR Art. 15/20, DPDP Sec. 11)
You have the right to obtain a machine-readable JSON archive containing all personal data, interest vectors, published reels, and consent logs associated with your account. You can request this in-app or via `POST /api/v1/compliance/export`.

### 4.2 Right to Erasure / Account Deletion (GDPR Art. 17, DPDP Sec. 12)
You have the right to delete your account. We provide a **30-day reversible grace period**:
- Upon request (`POST /api/v1/compliance/account/delete`), your profile is immediately frozen and live reels are archived from discovery feeds.
- You may cancel deletion anytime within 30 days (`POST /api/v1/compliance/account/cancel-deletion`).
- After 30 days, all personal data, reels, comments, and interest vectors are permanently crypto-shredded. Statutory financial tax ledgers are anonymized as mandated by fiscal law.

### 4.3 Right to Correction & Restriction (GDPR Art. 16/18)
You may update your profile details and pause any interest topic anytime via the "Pause Interest" control.

---

## 5. California Notice: CCPA / CPRA Disclosures

### 5.1 Do Not Sell or Share My Personal Information
- **No Data Brokers**: We **NEVER** sell your personal data to third parties or data brokers.
- **Interest-Only Ads**: Our sponsored reels target explicit interest tags without cross-context tracking or geofencing.
- **Opt-Out Control**: You may opt out of sponsored advertising anytime (`POST /api/v1/compliance/ccpa/opt-out`).

---

## 6. Children's Privacy (COPPA & DPDP Child Safeguards)

- **Under 13 Prohibition**: Interest does not permit registration for individuals under the age of 13.
- **Minors (Ages 13 to 17)**:
  - Targeted sponsored advertising is **strictly disabled** and locked to false.
  - Direct messages from strangers are blocked by default.
  - Minor profiles are excluded from unauthenticated web discovery.

---

## 7. Data Retention Schedule

- **Telemetry Seen Reels**: 14 Days TTL in cache.
- **Ephemeral Messages**: 24 Hours or 7 Days based on room setting.
- **Data Export Archives**: 48 Hours before token revocation.
- **Tax & Payment Invoices**: 7 Years (statutory legal requirement).
- **Inactive Accounts**: 24 Months prior to notification and archival.

---

## 8. Grievance Redressal & Data Protection Officer Contact

Under the India DPDP Act 2023 and global privacy frameworks:
- **Resident Grievance Officer & DPO**: Priya Sharma
- **Company**: Interest Media Private Limited
- **Address**: Level 6, Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103, India
- **Grievance Email**: `grievance-officer@interest.app`
- **Acknowledgment SLA**: Within 72 hours
- **Resolution SLA**: Within 15 business days
