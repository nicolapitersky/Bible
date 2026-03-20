# SEO_AEO.md — SEO & AI Engine Optimisation

> The rules of discoverability are changing fast. This document covers both traditional
> SEO and the emerging discipline of AEO — being found and cited by AI systems.
> Review monthly. The AEO section evolves rapidly.
> Last reviewed: See git log.

---

## Why This Matters More Than Ever

Search is fragmenting. Users now find information through:
1. Traditional search engines (Google, Bing)
2. AI chat interfaces (ChatGPT, Claude, Gemini, Perplexity)
3. AI-powered search results (Google AI Overviews, Bing Copilot)
4. Social search (TikTok, Instagram, Reddit)
5. Voice assistants

This organisation's products must be optimised for all of these.
A product that doesn't appear in AI responses is invisible to a growing segment of users.

---

## SEO — Traditional Search Engine Optimisation

### On-Page Requirements (every page)

```typescript
// Required for every page — use next-seo or equivalent
export const metadata: Metadata = {
  title: 'Page Title | Site Name',  // 50-60 characters
  description: 'Unique, compelling description of this specific page.', // 150-160 chars
  openGraph: {
    title: 'Page Title | Site Name',
    description: 'Description for social sharing',
    url: 'https://example.com/page',
    siteName: 'Site Name',
    images: [
      {
        url: 'https://example.com/og-image.jpg', // 1200×630px minimum
        width: 1200,
        height: 630,
        alt: 'Description of the image',
      }
    ],
    locale: 'en_GB',
    type: 'website', // or 'article' for blog posts
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Page Title',
    description: 'Description for Twitter',
    images: ['https://example.com/twitter-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  canonical: 'https://example.com/page', // Always set canonical
};
```

### Required Files

**`/public/robots.txt`**
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Sitemap: https://example.com/sitemap.xml
```

**`/public/sitemap.xml`** — auto-generated on build
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2025-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- All public pages — generated automatically -->
</urlset>
```

### Structured Data (JSON-LD)

Required on relevant page types. Add to `<head>` or as a `<script>` block.

**Organisation (homepage/about page)**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/handle",
    "https://linkedin.com/company/name"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "support@example.com"
  }
}
```

**Product page**
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "image": "https://example.com/product-image.jpg",
  "brand": {
    "@type": "Brand",
    "name": "Brand Name"
  },
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "GBP",
    "availability": "https://schema.org/InStock",
    "url": "https://example.com/product"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "89"
  }
}
```

**Article/Blog post**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Site Name",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  },
  "datePublished": "2025-01-01",
  "dateModified": "2025-01-15",
  "image": "https://example.com/article-image.jpg"
}
```

### Performance (SEO depends on Core Web Vitals)

Google uses Core Web Vitals as a ranking signal. Our budgets (from AGENTS.md):
- LCP < 2.5s — largest content loads fast
- CLS < 0.1 — layout doesn't shift
- FID/INP < 200ms — responsive to user input

Tactics:
- Images: use `next/image` (automatic optimisation, lazy loading, WebP/AVIF)
- Fonts: use `next/font` (zero CLS from font loading)
- Critical CSS inlined
- Non-critical JS deferred
- Preconnect to critical third-party domains

---

## AEO — AI Engine Optimisation

> AEO is the practice of ensuring AI systems (ChatGPT, Claude, Gemini, Perplexity)
> can discover, understand, and correctly represent your content.
> This field is evolving rapidly. Update this section monthly.

### The `llms.txt` Standard

**`/public/llms.txt`** — a new standard emerging in 2024-2025 that tells AI crawlers
about your site's content and how to use it.

```markdown
# Site Name

> Brief description of what this site/product is (1-2 sentences, as an AI would explain it)

## What we do

[2-3 clear paragraphs explaining the product/service in plain language.
Write as if explaining to an intelligent person who has never heard of you.
AI systems use this to understand and represent you accurately.]

## Key facts

- Founded: [year]
- Based in: [location]
- Products: [list]
- Pricing: [brief description]
- Who we serve: [description of customers]

## Key pages

- [Homepage](https://example.com/) — [what it contains]
- [Product](https://example.com/product) — [what it contains]
- [Pricing](https://example.com/pricing) — [pricing information]
- [Documentation](https://example.com/docs) — [technical documentation]
- [Blog](https://example.com/blog) — [articles and resources]

## What we are NOT

[Explicitly state common misconceptions or what you are not.
This helps AI systems avoid hallucinating incorrect information about you.]

## Contact

- Support: support@example.com
- Press: press@example.com
- API/Technical: developers@example.com
```

Also create `/public/llms-full.txt` — a longer version with full company information,
product details, and FAQ content that AI systems can use for comprehensive answers.

### Content for AI Discoverability

AI systems are trained on and retrieve web content. To be well-represented:

**Write in clear, declarative sentences.** AI systems struggle with clever copy.
"We help small businesses accept payments" is better than "Powering the payment revolution."

**Answer questions directly.** Create FAQ pages and documentation that answer the
questions your customers ask in AI interfaces. Structure: question → direct answer → detail.

**Be consistent.** Your site, social profiles, and documentation should describe you
consistently. AI systems aggregate information — inconsistency leads to confused representations.

**Create comprehensive documentation.** Well-documented products appear in AI responses
as answers to developer and user questions. Undocumented features are invisible to AI.

### Perplexity, ChatGPT, and Claude Optimisation

These systems now crawl and index web content in real-time or near-real-time.
The rules are similar to Google, with emphasis on:

- **Authority signals:** links from credible sources, industry publications, Wikipedia
- **Factual accuracy:** AI systems check claims against known facts — inaccuracies reduce trust
- **Freshness:** updated content is preferred for time-sensitive topics
- **Specificity:** vague content is ignored; specific, accurate content is cited
- **`llms.txt`:** increasingly supported by AI crawlers

### AI Overview Optimisation (Google)

Google's AI Overviews pull from highly-trusted, specific sources. To be featured:

- Answer the exact question in the first sentence of the relevant section
- Use headers that are questions (`<h2>How does X work?</h2>`)
- Include numbers and statistics (AI Overviews prefer specific facts)
- Earn links from authoritative sources in your industry
- Keep content accurate and up to date (AI Overviews penalise outdated content)

---

## Monthly AEO Review Checklist

```markdown
# AEO Review — {{MONTH}} {{YEAR}}

## Standards updates
- [ ] Check llms.txt standard updates: https://llmstxt.org
- [ ] Check if new AI crawlers need to be addressed in robots.txt
- [ ] Review Model Context Protocol developments for any new patterns

## Coverage check
- [ ] Search for [project name] in ChatGPT — accurate representation?
- [ ] Search for [project name] in Claude — accurate representation?
- [ ] Search for [project name] in Perplexity — accurate representation?
- [ ] Search for [project name] in Google AI Overviews — appearing?

## Content freshness
- [ ] llms.txt updated with any product changes?
- [ ] FAQ content reflects current product?
- [ ] Structured data still accurate?

## Technical
- [ ] Sitemap up to date and submitted to Google Search Console?
- [ ] robots.txt not accidentally blocking AI crawlers?
- [ ] Core Web Vitals stable?
- [ ] No crawl errors in Google Search Console?

## Competitive
- [ ] Search for [main use case] in AI interfaces — competitors appearing?
- [ ] What questions is the target customer asking AI? Create content for those.
```

---

## SEO Checklist for New Page Launch

Before any new page goes live:
- [ ] Unique `<title>` (50-60 chars, includes primary keyword)
- [ ] Unique `<meta description>` (150-160 chars, compelling)
- [ ] Canonical URL set
- [ ] Open Graph tags set (title, description, image 1200×630)
- [ ] Twitter Card tags set
- [ ] Relevant structured data (JSON-LD)
- [ ] Page added to sitemap
- [ ] robots.txt allows page (or has intentional disallow)
- [ ] Heading hierarchy correct (one H1, logical H2-H6 structure)
- [ ] Images have descriptive alt text
- [ ] Internal links to related content
- [ ] No broken links
- [ ] Page loads in < 2.5s on mobile
- [ ] Mobile responsive (test at 375px)
