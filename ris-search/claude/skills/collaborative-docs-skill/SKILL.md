---
name: collaborative-docs
description: Guide for collaboratively refining documentation and conceptual documents with users through iterative editing. Use when users want to work together to create, refine, or restructure documentation (concept docs, strategy docs, technical specs, guides) through back-and-forth conversation rather than receiving a completed document upfront.
---

# Collaborative Documentation

This skill provides guidance for working iteratively with users to create and refine documentation through conversation.

## Core Approach

**Philosophy:** Documentation is rarely perfect on the first try. Work with the user through multiple small iterations rather than trying to create a perfect document upfront. The goal is to make it easy for users to request changes and see them implemented immediately.

**Tone:**
- Conversational and collaborative, not formal or rigid
- Acknowledge when things feel "off" or could be improved
- Ask clarifying questions when ambiguous
- Provide structured feedback when requested
- Be concise in responses—users want edits, not essays about edits

## Workflow

### 1. Initial Creation

When creating a new document:

1. **Gather context first:** Ask about the document's purpose, audience, and any existing notes or rough ideas
2. **Start with structure:** Create a clear outline based on their input
3. **Fill in content:** Write sections based on the structure, keeping initial prose clear but not overly polished
4. **Present for feedback:** Share the document and explicitly invite critique

**Example opening:**
> "I've created a first draft based on your notes. The main improvements are [brief list]. Let me know what you'd like to adjust—we can refine this iteratively."

### 2. Iterative Refinement

Users will request changes in various ways:
- Direct edits: "Change X to Y"
- Structural feedback: "This section feels disconnected"
- Additions: "Can you add information about Z?"
- Deletions: "Remove the part about Q"
- Clarifications: "What I meant was..."

**For each request:**
1. Make the specific change requested
2. Keep responses minimal—just confirm what was changed
3. Re-share the updated document
4. Don't over-explain unless asked

**Example response:**
> "Done! Updated the description to reference user stories and acceptance criteria."

### 3. Providing Feedback

When users ask for feedback on the document:

**Structure your feedback:**
```
## Content Feedback
- What's working well
- Gaps or missing information
- Questions that need answers

## Structure Feedback
- Flow and organization observations
- Sections that feel disconnected or redundant
- Suggested reorganization (as options, not mandates)
```

**Keep it actionable:**
- Point to specific sections
- Suggest concrete improvements
- Ask questions rather than making assumptions
- Offer options, not prescriptions

### 4. Formatting and Style

**Markdown conventions:**
- Use headers to create clear hierarchy
- Use bullets for lists of items
- Use tables for structured comparisons
- Use code blocks with syntax highlighting for examples
- Use blockquotes (`>`) for callouts or important notes
- Use bold for emphasis sparingly

**Code examples:**
- Always show "do/don't" comparisons for best practices
- Use realistic variable names and scenarios
- Include comments when helpful but keep them minimal
- Match the user's existing code style if provided

**Links:**
- Link to external resources when referenced
- Make link text descriptive (not "click here")

### 5. Working with Existing Content

When users provide rough notes or existing docs:

1. **Preserve their voice and intent:** Don't completely rewrite—organize and clarify
2. **Ask before major changes:** If restructuring significantly, explain why and get approval
3. **Keep their examples:** If they provided specific examples, keep them unless there's a good reason not to
4. **Fill gaps incrementally:** Add missing information bit by bit rather than wholesale

## Common Patterns

### Technical Documentation
- Start with "Why" (purpose/goals)
- Explain "What" (concepts/components)
- Detail "How" (implementation/usage)
- End with "Additional considerations" (edge cases, gotchas)

### Strategy Documents
- Begin with clear problem statement
- Define scope explicitly (what's in, what's out)
- Present approach/solution
- Cover implementation details
- Note open questions and TODOs clearly

### Guides and How-tos
- Front-load prerequisites and context
- Use numbered steps for sequences
- Include examples for each major concept
- Provide troubleshooting or common pitfalls

## Anti-patterns

**Don't:**
- Write walls of text—break into digestible sections
- Over-format with excessive bold/italics/emoji
- Add unnecessary preambles to responses
- Apologize excessively for document imperfections
- Treat feedback requests as opportunities to write essays
- Make users wait for perfection—ship incremental improvements

**Do:**
- Make requested changes quickly and precisely
- Keep the conversation flowing with brief confirmations
- Trust users to tell you what needs changing
- Ask clarifying questions when genuinely unclear
- Provide substantive feedback only when explicitly requested

## Example Interaction Flow

```
User: Can you help me refine this concept doc? [pastes rough notes]

Claude: [Reviews notes] I'll help you organize this. Let me create a structured 
document based on your notes.
[Creates initial draft]

User: The purpose section needs more about how this relates to other testing

Claude: [Adds paragraph about complementary testing]
Done! Added clarification about E2E tests being complementary to unit tests.

User: Can you look at the whole doc and give me feedback?

Claude: [Provides structured feedback on content and structure]

User: Let's try your suggested structure refinement

Claude: [Implements restructuring]
Done! Restructured the document. The main changes are...

User: Perfect, thanks!
```

## Tips for Success

- **Stay responsive:** Users often work in bursts—match their energy and pace
- **Be precise:** When making edits, change exactly what was requested
- **Show don't tell:** Use examples and code snippets liberally
- **Maintain context:** Remember decisions made earlier in the conversation
- **Adapt to their style:** Match formality level and technical depth to the user
- **Default to action:** When in doubt, make the edit and let them adjust rather than asking for permission

The goal is to feel like a helpful colleague sitting next to them, not a formal documentation service.
