import type { WorkflowTemplate } from '../types/chat'

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'seo_content',
    label: 'SEO Content',
    template: `Help me generate SEO-optimised content.

**Topic / Target Keywords:** [Enter keywords here]
**Target Audience:** [Describe the reader]
**Content Type:** [Blog post / Product page / Landing page / Meta description]
**Word Count:** [e.g. 800 words]
**Tone:** [Professional / Conversational / Technical]

Additional notes or brand guidelines:
[Add anything specific here]`,
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
