import type { WorkflowTemplate } from '../types/chat'

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'seo_content',
    label: 'SEO Content',
    template: `Help me generate SEO-optimised content that meets Google's 2026 E-E-A-T standards.

**Topic / Target Keywords:** [Primary keyword + 2–3 secondary keywords]
**Target Audience:** [Describe the reader — who they are, what they need]
**Content Type:** [Blog post / Service page / Landing page / Local SEO page / Comparison page]
**Word Count:** [Informational: 1,200–2,000 | Comparison: 800–1,500 | Local SEO: 600–1,000]
**Tone:** [Professional / Conversational / Technical]
**First-hand Experience to Include:** [Real client result, case study, or specific data point we can reference — e.g. "Client X saw 40% traffic increase in 3 months"]
**Named Sources / Studies to Reference:** [Any specific stats, reports, or authorities to cite]
**Competing Pages to Beat:** [Paste 1–3 competitor URLs if available]

Additional notes or brand guidelines:
[Add anything specific here]

---
Generate the full article with:
- H1 (≤7 words, primary keyword in first 3 words)
- H2 structure (4–8 sections, secondary keywords included)
- Body copy with at least one first-hand experience signal
- Meta title (50–60 chars), meta description (140–160 chars), and URL slug
- Internal link placeholder: [INTERNAL LINK: topic]
- Outbound links to 2 authoritative sources`,
  },
  {
    id: 'seo_content_qa',
    label: 'SEO Content QA',
    template: `Run a full Google 2026 algorithm QA audit on the following content before publishing.

**Content to audit:**
[Paste the full article draft here]

**Target keyword:** [Primary keyword]
**Content type:** [Blog post / Service page / Landing page / etc.]
**Domain it will be published on:** [URL]
**Recent publish count on this domain:** [How many articles published in the last 30 days?]

---
Run all 5 QA layers and return a full report:

**Layer 1 — E-E-A-T Audit** (Experience · Expertise · Authoritativeness · Trust)
- Flag any missing first-hand experience signals
- Flag vague authority claims ("experts say", "studies show" without names/sources)
- Flag missing author attribution

**Layer 2 — Fact-Check**
- Extract all factual claims and statistics
- Mark each as: ✅ Verified / ⚠️ Unverified / ❌ Hallucinated
- Rewrite or flag ❌ items — these are hard blocks

**Layer 3 — LLM Fingerprint Removal**
- Detect and rewrite: hedge stacks, symmetrical lists, generic openers, wishy-washy conclusions
- Ensure the article has a clear point of view and sounds like a specific person

**Layer 4 — Velocity & Spam Check**
- Flag if this article is a near-duplicate of another on the same domain
- Flag if the primary intent appears to be ranking manipulation vs. user value
- Note if publishing velocity on this domain is approaching risk threshold

**Layer 5 — Technical SEO**
- H1 word count and keyword placement
- Meta title and description character counts
- Slug format
- Heading structure (H2 count, secondary keywords)
- Internal and outbound link presence

---
Return:
1. Score table (each layer 0–10, total /50)
2. Verdict: APPROVED / CONDITIONAL / NEEDS WORK / BLOCKED
3. Required fixes list (prefixed [L1]–[L5])
4. Full edited draft with fixes applied inline
5. Items that require human input marked [ACTION NEEDED: description]`,
  },
  {
    id: 'qa_review',
    label: 'Team QA Review',
    template: `Please QA the following content and flag any issues.

**Content to review:**
[Paste content here]

**QA checklist:**
- No unfilled placeholders (e.g. [CLIENT NAME], [DATE])
- Consistent capitalisation and formatting
- No em dashes — use hyphens instead
- Numbers and data are consistent throughout
- Brand voice: direct, concise, no fluff
- Clear call to action

Return a Green / Yellow / Red verdict with specific line-level fixes.`,
  },
  {
    id: 'brand_workshop',
    label: 'Brand Workshop',
    template: `Run a brand strategy workshop for this client.

**Business Name:** [Enter name]
**Industry:** [Enter industry / niche]
**Target Audience:** [Primary customer profile]
**Core Problem They Solve:** [What pain does this business fix?]
**Current Brand Status:** [Starting fresh / has existing assets]

Deliver:
1. Brand positioning statement
2. Core brand values (3-5)
3. Brand voice and tone guidelines
4. Key messaging pillars
5. Competitive differentiation angle

Ask clarifying questions if needed before delivering the framework.`,
  },
  {
    id: 'brand_design',
    label: 'Brand Design',
    template: `Develop brand design direction for this client.

**Business Name:** [Enter name]
**Industry:** [Enter industry]
**Brand Personality:** [e.g. Bold / Minimal / Playful / Premium / Technical]
**Target Audience:** [Who will see this brand?]
**Existing Assets:** [Describe current logo/colours/fonts — or say "starting from scratch"]

Deliver:
1. Colour palette direction (primary, secondary, accent with hex suggestions)
2. Typography pairings (heading + body font recommendations)
3. Visual style direction (imagery, iconography style)
4. 2-3 logo concept directions
5. Moodboard description a designer can act on`,
  },
]
