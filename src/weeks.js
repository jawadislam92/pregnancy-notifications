// Per-milestone content for the 10 calendar pages (weeks 4,8,...,40).
// Bilingual (English / German). This is OUR data model — not tied to the
// original Google Sheet format. Everything here is editable and extendable.
//
// Colours: `primary` themes the month title, week badge, section headers and
// callout label. `accent` tints the highlighted gestational week in the grid.
// Body copy and labels use the shared neutral grey defined in layout.js.

module.exports = [
  {
    week: 4, fruit: { en: 'Poppy seed', de: 'Mohnkorn' },
    length: '1–2 mm', weight: '< 1 g',
    primary: '#b267a3', accent: '#ffd0dd',
    babyDev: {
      en: 'Your baby is now about the size of a poppy seed. The first foundations for the brain, spinal cord and organs are beginning to form.',
      de: 'Dein Baby ist jetzt etwa so groß wie ein Mohnkorn. Die ersten Grundlagen für Gehirn, Rückenmark und Organe entstehen gerade.'
    },
    mama: {
      en: ['You may feel more tired than usual', 'Mood swings', 'Breast tenderness', 'Heightened sense of smell'],
      de: ['Du fühlst dich vielleicht müder als sonst', 'Stimmungsschwankungen', 'Spannungsgefühl in der Brust', 'Verstärkter Geruchssinn']
    },
    callout: {
      label: { en: 'Fun fact', de: 'Fun Fact' },
      text: { en: 'Many women don’t even know they’re pregnant yet during this week.',
              de: 'Viele Frauen wissen in dieser Woche noch gar nicht, dass sie schwanger sind.' }
    }
  },
  {
    week: 8, fruit: { en: 'Raspberry', de: 'Himbeere' },
    length: '1.5 cm', weight: '< 1 g',
    primary: '#b267a3', accent: '#ffb27f',
    babyDev: {
      en: 'Your baby is now about the size of a raspberry. Tiny movements are already beginning inside the womb.',
      de: 'Dein Baby ist jetzt etwa so groß wie eine Himbeere. Erste kleine Bewegungen beginnen bereits im Bauch.'
    },
    mama: {
      en: ['Increased appetite', 'Emotional ups and downs', 'Occasional nausea'],
      de: ['Größerer Appetit', 'Emotionale Höhen und Tiefen', 'Gelegentliche Übelkeit']
    },
    callout: {
      label: { en: 'Fun fact', de: 'Fun Fact' },
      text: { en: 'Even though you can’t feel them yet, your baby is already moving around.',
              de: 'Auch wenn du sie noch nicht spürst — dein Baby bewegt sich schon fleißig.' }
    }
  },
  {
    week: 12, fruit: { en: 'Lemon', de: 'Zitrone' },
    length: '5–6 cm', weight: '< 14 g',
    primary: '#4282aa', accent: '#9ecbe0',
    babyDev: {
      en: 'Your baby is now about the size of a lemon. Tiny reflexes continue developing every day.',
      de: 'Dein Baby ist jetzt etwa so groß wie eine Zitrone. Kleine Reflexe entwickeln sich täglich weiter.'
    },
    mama: {
      en: ['Nausea often begins to ease', 'A little more energy', 'Appetite returning'],
      de: ['Die Übelkeit lässt oft nach', 'Etwas mehr Energie', 'Der Appetit kommt zurück']
    },
    callout: {
      label: { en: 'Mini riddle', de: 'Mini-Rätsel' },
      text: { en: 'What is your baby already secretly practicing? Answer: Swallowing and sucking.',
              de: 'Was übt dein Baby heimlich schon? Antwort: Schlucken und Saugen.' }
    },
    tip: {
      en: 'Have you already shared the exciting news with your loved ones?',
      de: 'Hast du die frohe Botschaft schon mit deinen Liebsten geteilt?'
    }
  },
  {
    week: 16, fruit: { en: 'Apple', de: 'Apfel' },
    length: '11–12 cm', weight: '100 g',
    primary: '#4f6815', accent: '#a9c06a',
    babyDev: {
      en: 'Your baby is now about the size of an apple. The ears keep developing — your baby may soon begin hearing sounds.',
      de: 'Dein Baby ist jetzt etwa so groß wie ein Apfel. Die Ohren entwickeln sich weiter — bald nimmt dein Baby erste Geräusche wahr.'
    },
    mama: {
      en: ['A rounder belly', 'More energy than before', 'Your skin may glow'],
      de: ['Ein rundlicher Bauch', 'Mehr Energie als zuvor', 'Strahlende Haut']
    },
    callout: {
      label: { en: 'Fun fact', de: 'Fun Fact' },
      text: { en: 'Amniotic fluid is completely renewed every single day.',
              de: 'Das Fruchtwasser erneuert sich jeden Tag vollständig.' }
    },
    tip: {
      en: 'Preparation Tip: It might be fun to slowly start picking out first baby essentials.',
      de: 'Vorbereitungstipp: Vielleicht macht es Spaß, langsam erste Babysachen auszusuchen.'
    }
  },
  {
    week: 20, fruit: { en: 'Carrot', de: 'Karotte' },
    length: '16–17 cm', weight: '300 g',
    primary: '#632713', accent: '#c98a63',
    babyDev: {
      en: 'Your baby is now about the size of a carrot. You’ve officially reached the halfway point of pregnancy!',
      de: 'Dein Baby ist jetzt etwa so groß wie eine Karotte. Die Hälfte der Schwangerschaft ist geschafft!'
    },
    mama: {
      en: ['Belly clearly visible now', 'First tiny kicks', 'Emotional moments'],
      de: ['Der Bauch ist deutlich sichtbar', 'Erste zarte Tritte', 'Emotionale Momente']
    },
    callout: {
      label: { en: 'Fun fact', de: 'Fun Fact' },
      text: { en: 'Babies already sleep inside the womb, sometimes even with tiny dream phases.',
              de: 'Babys schlafen schon im Bauch — manchmal sogar mit kleinen Traumphasen.' }
    },
    tip: {
      en: 'Important Appointment: Around this time, many parents have the detailed anatomy scan.',
      de: 'Wichtiger Termin: Rund um diese Zeit findet oft der große Organ-Ultraschall statt.'
    }
  },
  {
    week: 24, fruit: { en: 'Cauliflower', de: 'Blumenkohl' },
    length: '30 cm', weight: '600 g',
    primary: '#67698e', accent: '#ffb27f',
    babyDev: {
      en: 'Your baby is now about the size of a cauliflower. The brain is growing rapidly and facial expressions become more noticeable.',
      de: 'Dein Baby ist jetzt etwa so groß wie ein Blumenkohl. Das Gehirn wächst rasant und das Gesicht wird ausdrucksstärker.'
    },
    mama: {
      en: ['Increased hunger', 'Slight swelling', 'Stronger baby movements'],
      de: ['Mehr Hunger', 'Leichte Wassereinlagerungen', 'Kräftigere Bewegungen']
    },
    callout: {
      label: { en: 'Did you know?', de: 'Schon gewusst?' },
      text: { en: 'Babies can already react to loud sounds now.',
              de: 'Babys können jetzt schon auf laute Geräusche reagieren.' }
    }
  },
  {
    week: 28, fruit: { en: 'Pineapple', de: 'Ananas' },
    length: '37–38 cm', weight: '1,200 g',
    primary: '#67698e', accent: '#ffaadc',
    babyDev: {
      en: 'Your baby is about the size of a pineapple. The brain keeps building billions of new connections.',
      de: 'Dein Baby ist ungefähr so groß wie eine Ananas. Das Gehirn bildet weiterhin Milliarden neuer Verbindungen.'
    },
    mama: {
      en: ['Third trimester begins', 'Shorter breath at times', 'More frequent breaks'],
      de: ['Das dritte Trimester beginnt', 'Manchmal kürzerer Atem', 'Häufigere Pausen']
    },
    callout: {
      label: { en: 'Did you know?', de: 'Schon gewusst?' },
      text: { en: 'Your baby can now blink.',
              de: 'Dein Baby kann jetzt blinzeln.' }
    },
    tip: {
      en: 'Preparation Tip: Many hospitals recommend registering for the birth around this time.',
      de: 'Vorbereitungstipp: Viele Kliniken empfehlen, sich jetzt zur Geburt anzumelden.'
    }
  },
  {
    week: 32, fruit: { en: 'Chinese cabbage', de: 'Chinakohl' },
    length: '42–43 cm', weight: '1,900 g',
    primary: '#4f6815', accent: '#8f6f9e',
    babyDev: {
      en: 'Your baby is about the size of a Chinese cabbage. The bones keep developing but stay soft enough for birth.',
      de: 'Dein Baby ist ungefähr so groß wie ein Chinakohl. Die Knochen entwickeln sich weiter, bleiben aber weich genug für die Geburt.'
    },
    mama: {
      en: ['More downward pressure', 'Tiring more quickly', 'Trouble sleeping'],
      de: ['Mehr Druck nach unten', 'Schnellere Erschöpfung', 'Unruhiger Schlaf']
    },
    callout: {
      label: { en: 'Did you know?', de: 'Schon gewusst?' },
      text: { en: 'Your baby is already practicing breathing movements for life after birth.',
              de: 'Dein Baby übt schon Atembewegungen für das Leben nach der Geburt.' }
    },
    tip: {
      en: 'Preparation Tip: This might be a great time to slowly start packing your hospital bag.',
      de: 'Vorbereitungstipp: Jetzt ist ein guter Zeitpunkt, langsam die Kliniktasche zu packen.'
    }
  },
  {
    week: 36, fruit: { en: 'Pointed cabbage', de: 'Spitzkohl' },
    length: '47 cm', weight: '2,700 g',
    primary: '#4f6815', accent: '#8f6f9e',
    babyDev: {
      en: 'Your baby is about the size of a pointed cabbage. Many babies slowly turn into birth position around this time.',
      de: 'Dein Baby ist ungefähr so groß wie ein Spitzkohl. Viele Babys drehen sich jetzt langsam in Geburtsposition.'
    },
    mama: {
      en: ['Stronger pelvic pressure', 'Pulling sensations', 'Baby dropping lower'],
      de: ['Stärkerer Beckendruck', 'Ziehen im Becken', 'Das Baby rutscht tiefer']
    },
    callout: {
      label: { en: 'Mini riddle', de: 'Mini-Rätsel' },
      text: { en: 'Which sense is your baby using especially actively now? Answer: Touch.',
              de: 'Welchen Sinn nutzt dein Baby jetzt besonders aktiv? Antwort: den Tastsinn.' }
    },
    tip: {
      en: 'Reminder: If you haven’t already, now is a great time to install the car seat.',
      de: 'Erinnerung: Falls noch nicht erledigt — jetzt ist ein guter Zeitpunkt für den Autositz.'
    }
  },
  {
    week: 40, fruit: { en: 'Large pumpkin', de: 'Großer Kürbis' },
    length: '51–53 cm', weight: '3,500 g',
    primary: '#58355e', accent: '#ffb27f',
    babyDev: {
      en: 'Your baby is now about the size of a large pumpkin. The organs are fully developed and your baby is ready for the big journey into the world.',
      de: 'Dein Baby ist jetzt etwa so groß wie ein großer Kürbis. Die Organe sind vollständig entwickelt und dein Baby ist bereit für die große Reise.'
    },
    mama: {
      en: ['Waves of emotion', 'First signs of labor', 'Lots of anticipation'],
      de: ['Emotionen in Wellen', 'Erste Anzeichen der Geburt', 'Große Vorfreude']
    },
    callout: {
      label: { en: 'The Big Moment', de: 'Der große Moment' },
      text: { en: 'Your baby could decide to meet you at any moment now.',
              de: 'Dein Baby könnte sich jederzeit auf den Weg machen, um dich kennenzulernen.' }
    }
  }
];
