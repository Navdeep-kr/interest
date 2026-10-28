# Digital Millennium Copyright Act (DMCA) & IP Policy
**Effective Date: October 12, 2026 | Safe Harbor Compliance (17 U.S.C. § 512)**

---

## 1. DMCA Safe Harbor Notice & Takedown Procedure

Interest respects the intellectual property rights of artists, producers, and creators. In accordance with Title 17, United States Code, Section 512(c)(2), this document outlines our statutory notification and counter-notification process.

### Designated Copyright Agent
- **Agent Name**: Copyright Agent, Interest Media Legal Department
- **Email**: `dmca@interest.app`
- **Address**: Interest Media Legal, Level 6, Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103
- **Online Filing**: `POST /api/v1/compliance/dmca/notice`

---

## 2. Filing a Formal DMCA Notice

To be legally valid, a Notice of Claimed Infringement must include:
1. **Identification of the copyrighted work** claimed to have been infringed.
2. **Identification of the infringing reel** (Reel UUID or public URL).
3. **Contact information** of the copyright owner or authorized representative (Name, Address, Email, Phone).
4. **Statement of Good Faith Belief**: "I have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law."
5. **Statement under Penalty of Perjury**: "The information in this notification is accurate, and under penalty of perjury, I am the owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."
6. **Physical or electronic signature** of the authorized agent.

### Action Upon Receipt:
Upon receiving a complete notice, Interest will expeditiously:
- Remove or disable access to the identified reel (`status = ARCHIVED`).
- Notify the affected creator with a copy of the claim.
- Log a copyright strike on the creator's account.

---

## 3. Filing a DMCA Counter-Notice (17 U.S.C. § 512(g))

If you believe your content was disabled or removed as a result of a mistake or misidentification, you may submit a Counter-Notification (`POST /api/v1/compliance/dmca/counter-notice`).

The counter-notice must include:
1. **Identification of the specific reel** removed (Ticket number and Reel UUID).
2. **Your full name, address, telephone number, and email address**.
3. **Statement under Penalty of Perjury**: "I swear, under penalty of perjury, that I have a good faith belief that the material was removed or disabled as a result of mistake or misidentification."
4. **Consent to Federal Court Jurisdiction**: Consent to the jurisdiction of the federal district court for your judicial district, or if outside the United States, to any judicial district in which Interest may be found.
5. **Physical or electronic signature**.

---

## 4. 10 to 14 Business Day Statutory Restoration Window

Upon receiving a valid Counter-Notice:
1. We forward a copy to the original claimant, informing them that the removed content will be restored in **10 to 14 business days**.
2. If the claimant does **not** provide proof of having filed a court action seeking an injunction against the creator within 14 business days, Interest is required by federal law to restore the material to the platform (`status = PUBLISHED`).

---

## 5. Repeat Infringer Policy (The 3-Strikes Rule)

Interest maintains a strict policy for repeat copyright infringers:
- **Strike 1**: Content removed, formal copyright warning issued.
- **Strike 2**: Content removed, 14-day monetization and video upload suspension.
- **Strike 3**: Immediate and permanent termination of the creator account.
