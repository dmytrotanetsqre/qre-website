/* ==========================================================================
   Option 3 — the chat drawer's script (all of its copy, as plain data).
   chat.js reads window.QRE_CHAT_SCRIPT and runs the steps top to bottom.

   Step fields
     id        step name; `next` names the step that follows.
     say       the assistant's text. Placeholders take earlier answers:
               {service}         the answer saved as `service`, as given;
               {service|lower}   the same, first letter lowered unless the
                                 word is an acronym ("AI agent" stays);
               {, name}          ", " + name, or nothing when name is empty.
     chips     quick replies. `keywords` match typed text (case-insensitive,
               at the start of a word; whole words on text steps); `value` is what is saved (default:
               the label); `action: 'restart'` starts the conversation over.
     accepts   'chips'  chips, or any typed text kept as the user's own answer;
               'text'   free text (the chips are shortcuts);
               'email'  a valid e-mail address, else `invalid` is said;
               'none'   the end: only the chips act.
     saveAs    the lead field the answer goes to.
     topic     a FAQ id this step is itself about: on this step that FAQ only
               answers a message phrased as a question.
     summary   rows [label, field] listed after `say`; `after` follows them.

   FAQ: a typed message that matches one of these, phrased as a question (or
   containing one of the `phrases`), is answered first; then the current
   step's question is asked again.
   ========================================================================== */

window.QRE_CHAT_SCRIPT = {
  steps: [
    {
      id: 'greeting',
      say: 'Hi, I’m the QRE assistant. I can help you scope your project and set up a free consultation with our team. What would you like to build?',
      chips: [
        { label: 'AI agent', keywords: ['agent', 'chatbot', 'assistant', 'voice'] },
        { label: 'Custom AI model', keywords: ['model', 'llm', 'fine-tun', 'machine learning', 'ml'] },
        { label: 'Mobile or desktop app', keywords: ['mobile', 'desktop', 'app', 'ios', 'android'] },
        { label: 'Website', keywords: ['website', 'web', 'site', 'landing'] },
        { label: 'Business automation', keywords: ['automat', 'workflow', 'process', 'integration'] },
        { label: 'Analytics', keywords: ['analytic', 'dashboard', 'report', 'data', 'insight'] },
        { label: 'Something else', keywords: ['something else', 'other'] },
      ],
      accepts: 'chips',
      saveAs: 'service',
      next: 'details',
    },
    {
      id: 'details',
      say: 'Great, {service|lower} is something we do a lot. Tell me a bit more: what should it do, and who will use it?',
      chips: [
        { label: 'Not sure yet', keywords: ['not sure', 'unsure', 'no idea', 'don’t know', "don't know", 'dunno'] },
      ],
      accepts: 'text',
      saveAs: 'details',
      next: 'stage',
    },
    {
      id: 'stage',
      say: 'Thanks, that helps. Where are you right now?',
      chips: [
        { label: 'Just an idea', keywords: ['idea', 'concept', 'scratch'] },
        { label: 'I have designs or a spec', keywords: ['design', 'spec', 'mockup', 'wireframe', 'figma', 'prototype', 'brief'] },
        { label: 'I have a product to improve', keywords: ['product', 'improve', 'existing', 'already', 'live', 'launched'] },
      ],
      accepts: 'chips',
      saveAs: 'stage',
      next: 'timeline',
    },
    {
      id: 'timeline',
      say: 'When would you like to get started?',
      chips: [
        { label: 'As soon as possible', keywords: ['asap', 'as soon', 'soon', 'now', 'immediately', 'right away', 'urgent'] },
        { label: 'In 1 to 3 months', keywords: ['1 to 3', '1-3', 'next month', 'few months', 'couple of months', '1 month', '2 months', '3 months'] },
        { label: 'Later this year', keywords: ['later', 'this year', 'end of the year'] },
        { label: 'Just exploring', keywords: ['explor', 'just looking', 'browsing', 'no rush', 'not sure'] },
      ],
      accepts: 'chips',
      saveAs: 'timeline',
      topic: 'timeline',
      next: 'budget',
    },
    {
      id: 'budget',
      say: 'Do you have a budget range in mind? A rough idea is fine.',
      chips: [
        { label: 'Under $25k', keywords: ['under', 'less than', 'below', 'small'] },
        { label: '$25k to $100k', keywords: ['25k to', '25-100', '$25k to', 'between'] },
        { label: 'Over $100k', keywords: ['over', 'more than', 'above', '100k+'] },
        { label: 'Not sure yet', keywords: ['not sure', 'unsure', 'no idea', 'don’t know', "don't know", 'dunno'] },
      ],
      accepts: 'chips',
      saveAs: 'budget',
      topic: 'pricing',
      next: 'name',
    },
    {
      id: 'name',
      say: 'Who am I talking to? Your name and company, please.',
      chips: [
        { label: 'Skip', keywords: ['skip', 'rather not', 'no thanks'], value: '' },
      ],
      accepts: 'text',
      saveAs: 'name',
      next: 'email',
    },
    {
      id: 'email',
      say: 'Last thing: what’s the best e-mail to reach you?',
      accepts: 'email',
      invalid: 'That doesn’t look like an e-mail address. Could you check it?',
      saveAs: 'email',
      next: 'summary',
    },
    {
      id: 'summary',
      say: 'Thanks{, name}. Here’s what I’ll pass to the team:',
      summary: [
        ['Project', 'service'],
        ['Details', 'details'],
        ['Stage', 'stage'],
        ['Start', 'timeline'],
        ['Budget', 'budget'],
        ['E-mail', 'email'],
      ],
      after: 'We’ll get back to you within 24 hours to set up a call.',
      chips: [
        { label: 'Start over', keywords: ['start over', 'restart', 'again', 'new'], action: 'restart' },
      ],
      accepts: 'none',
    },
  ],

  faq: [
    {
      id: 'pricing',
      keywords: ['price', 'pricing', 'cost', 'how much', 'rate', 'rates'],
      phrases: ['how much'],
      answer: 'Every project is different. After a short call the team will send you an estimate.',
    },
    {
      id: 'timeline',
      keywords: ['how long', 'timeline', 'deadline', 'weeks', 'months'],
      phrases: ['how long'],
      answer: 'A first version usually takes a few weeks to a few months, depending on scope. The team will give you a real timeline after the call.',
    },
    {
      id: 'who',
      keywords: ['who are you', 'are you human', 'bot', 'real person', 'are you a person', 'are you real'],
      phrases: ['who are you', 'are you human', 'real person', 'are you a bot', 'are you a person', 'are you real'],
      answer: 'I’m an AI assistant for QRE. Our team reads every conversation and will follow up personally.',
    },
  ],
};
