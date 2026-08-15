/* The 21 screening questions from §7.4. One question per screen.
 * Wellbeing routes features. It never blocks access.
 */
const YN = [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }];

export const CHAPTERS = [
  {
    id: 'medical', title: 'Health', note: 'Seven quick questions. A yes here means we ask you to get cleared first — it is not a no.',
    questions: [
      { id: 'q1', text: 'Has a doctor ever said you have a heart condition, or that you should only exercise under supervision?', options: YN },
      { id: 'q2', text: 'Do you get chest pain, at rest or during activity?', options: YN },
      { id: 'q3', text: 'Do you lose your balance from dizziness, or ever lose consciousness?', options: YN },
      { id: 'q4', text: 'Do you have a bone, joint or soft-tissue problem that exercise could make worse?', options: YN },
      { id: 'q5', text: 'Are you taking medication for blood pressure or a heart condition?', options: YN },
      { id: 'q6', text: 'Are you pregnant, or within 12 weeks of giving birth?', options: YN },
      { id: 'q7', text: 'Is there any other reason you should not do physical activity?', options: YN }
    ]
  },
  {
    id: 'msk', title: 'Shoulders and elbows', note: 'This is the part of you the training loads hardest. Previous injury is the strongest predictor of new injury.',
    questions: [
      { id: 'q8', text: 'Have you ever dislocated a shoulder, or had shoulder or elbow surgery?', options: YN },
      { id: 'q9', text: 'Do you have pain right now in a shoulder, elbow, wrist or hand?', options: YN },
      { id: 'q10', text: 'Do you get pain reaching overhead, or shoulder pain at night?', options: YN },
      { id: 'q11', text: 'Any history of tennis elbow or golfer’s elbow?', options: YN },
      { id: 'q12', text: 'Any neck problems, or numbness or tingling in your arms or hands?', options: YN }
    ]
  },
  {
    id: 'equipment', title: 'Your bar', note: 'This is the one thing we will not guess about. A bar coming off a door frame is the most common way people get hurt.',
    questions: [
      { id: 'q13', text: 'What kind of bar do you have?', options: [
          { v: 'doorway', l: 'Doorway' }, { v: 'wall', l: 'Wall-mounted' },
          { v: 'freestanding', l: 'Freestanding frame' }, { v: 'outdoor', l: 'Outdoor / park' }, { v: 'none', l: 'No bar yet' }] },
      { id: 'q14', text: 'Do you know its weight rating, and is your bodyweight below it?', hint: 'Usually printed on the bar or in its manual.',
        options: [{ v: 'yes', l: 'Yes, I’ve checked' }, { v: 'no', l: 'No, or I’m not sure' }] },
      { id: 'q15', text: 'Is there clear floor space and enough headroom above the bar?', options: YN }
    ]
  },
  {
    id: 'baseline', title: 'Where you are now', note: 'This sets your starting point. There is no wrong answer — most people who start here are at zero.',
    questions: [
      { id: 'q16', text: 'How long can you hang from the bar?', options: [
          { v: '0', l: 'I can’t yet' }, { v: '<10', l: 'Under 10 seconds' }, { v: '10-30', l: '10 to 30 seconds' }, { v: '>30', l: 'Over 30 seconds' }] },
      { id: 'q17', text: 'How many pull-ups or chin-ups can you do right now?', options: [
          { v: '0', l: 'None' }, { v: '1-2', l: '1 or 2' }, { v: '3-5', l: '3 to 5' }, { v: '6-10', l: '6 to 10' }, { v: '11+', l: '11 or more' }] },
      { id: 'q18', text: 'How many full press-ups?', options: [
          { v: '0', l: 'None' }, { v: '1-5', l: '1 to 5' }, { v: '6-15', l: '6 to 15' }, { v: '16+', l: '16 or more' }] },
      { id: 'q19', text: 'How many days a week have you exercised in the last month?', options: [
          { v: '0', l: 'None' }, { v: '1-2', l: '1 or 2' }, { v: '3-4', l: '3 or 4' }, { v: '5+', l: '5 or more' }] }
    ]
  },
  {
    id: 'wellbeing', title: 'How we should treat you', note: 'These answers change what the app shows you. They never change what you can access.',
    questions: [
      { id: 'q20', text: 'Have you ever been diagnosed with, or treated for, an eating disorder?',
        hint: 'If yes, we permanently switch off every weight and body-composition feature and will not ask again.', options: YN },
      { id: 'q21', text: 'What are you here for?', options: [
          { v: 'strength', l: 'Strength' }, { v: 'fatloss', l: 'Fat loss' },
          { v: 'both', l: 'Both' }, { v: 'other', l: 'Something else' }] }
    ]
  }
];

export const ALL_QUESTIONS = CHAPTERS.flatMap(c => c.questions.map(q => ({ ...q, chapter: c.id })));
