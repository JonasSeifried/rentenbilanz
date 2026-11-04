// Kurze Erklärungen zu Fachbegriffen (als Popover am „?“ bzw. an unterstrichenen Begriffen).
// Inhaltlich aus den geprüften Hinweistexten des Originals abgeleitet; Fundstellen siehe „Annahmen & Grenzen“.

export interface GlossaryEntry { title: string; text: string[] }

export const GLOSSARY = {
  zve: {
    title: 'Zu versteuerndes Einkommen',
    text: [
      'Bruttogehalt minus Werbungskosten, Sozialversicherungsbeiträge und weitere Abzüge. Es steht im Steuerbescheid.',
      'Als Faustregel liegt es bei Angestellten bei etwa 80 % des Bruttogehalts.',
    ],
  },
  incRet: {
    title: 'Einkommen im Alter',
    text: [
      'Steuerpflichtiges Einkommen im Ruhestand ohne die hier verglichenen Produkte, zum Beispiel gesetzliche Rente, Betriebsrente oder Mieteinnahmen. Bei Rentenbeginn ab 2058 ist die gesetzliche Rente voll steuerpflichtig.',
      'Dieser Wert bestimmt den Steuersatz auf die Auszahlungen im Alter. Betrag in heutigem Geld.',
      'Die voraussichtliche gesetzliche Rente steht in der jährlichen Renteninformation (Monatsbetrag × 12).',
    ],
  },
  rendite: {
    title: 'Rendite',
    text: [
      'Angenommene durchschnittliche Wertentwicklung pro Jahr vor Kosten. Das ist eine Annahme, keine Prognose.',
      'Gerechnet wird mit einer konstanten Rendite. In Wirklichkeit schwanken Aktienkurse stark, auch über Jahre.',
    ],
  },
  rentenbeginn: {
    title: 'Rentenbeginn',
    text: ['Ab diesem Alter wird ausgezahlt. Das Altersvorsorgedepot erlaubt einen Rentenbeginn zwischen 65 und 70; früher nur, wenn vorher eine gesetzliche Altersrente beginnt. Der Rechner ist auf 65–70 begrenzt.'],
  },
  kvFreiwillig: {
    title: 'Freiwillig gesetzlich versichert im Alter',
    text: [
      'Wer als Rentner nicht in die Krankenversicherung der Rentner (KVdR) kommt, aber gesetzlich versichert bleibt, ist freiwillig versichert. Dann zählen auch Auszahlungen aus privater Vorsorge für den Beitrag, bis zur Beitragsbemessungsgrenze (2026: 69.750 € im Jahr).',
      'Das betrifft häufig Menschen, die zeitweise privat versichert waren, etwa weil sie über der Versicherungspflichtgrenze (2026: 77.400 €) verdient haben.',
      'In der KVdR oder privat versichert: Dann fallen im Modell keine Beiträge auf die Auszahlungen an.',
    ],
  },
  kvdr: {
    title: 'KVdR (Krankenversicherung der Rentner)',
    text: [
      'Pflichtversicherung für Rentner. Hinein kommt, wer in der zweiten Hälfte des Erwerbslebens zu mindestens 90 % gesetzlich versichert war; freiwillige Zeiten zählen mit.',
      'Je Kind werden 3 Jahre angerechnet.',
      'Auf Auszahlungen aus privater Vorsorge fallen dort im Modell keine Beiträge an.',
    ],
  },
  kvRate: {
    title: 'Beitragssatz bei freiwilliger Versicherung',
    text: ['Satz auf die Zusatzeinnahmen für Mitglieder ohne Anspruch auf Krankengeld: 14,0 % ermäßigter Beitrag (§ 243 SGB V), Ø-Zusatzbeitrag 2026 2,9 % und Pflegeversicherung 4,2 % (kinderlos; mit Kind 3,6 %), zusammen etwa 21,1 % (mit Kind 20,5 %).'],
  },
  kaufkraft: {
    title: 'Heutige Kaufkraft',
    text: [
      'Alle Beträge werden mit der angenommenen Inflation in heutiges Geld umgerechnet. So lassen sich Beträge aus verschiedenen Jahrzehnten vergleichen.',
      'Beispiel: 1.000 € in 40 Jahren sind bei 2 % Inflation heute nur rund 450 € wert.',
      'Welches Produkt vorne liegt, wird immer in heutiger Kaufkraft verglichen. In knappen Fällen kann das vorne liegende Produkt in der nominalen Ansicht die kleinere Summe zeigen.',
    ],
  },
  avd: {
    title: 'Altersvorsorgedepot (AVD)',
    text: [
      'Neues staatlich gefördertes Wertpapierdepot ab 2027 (Altersvorsorgereformgesetz vom 26.05.2026). Eigenbeiträge bis 1.800 € im Jahr werden mit Zulagen gefördert, zusätzlich gibt es eventuell eine Steuererstattung.',
      'Ausgezahlt wird ab 65 bis 70 als Auszahlplan, die Auszahlung ist voll einkommensteuerpflichtig.',
    ],
  },
  zulagen: {
    title: 'Zulagen beim Altersvorsorgedepot',
    text: [
      'Grundzulage: 50 % auf die ersten 360 € Eigenbeitrag im Jahr, 25 % auf den Teil bis 1.800 € (höchstens 540 €). Mindestens 120 € Eigenbeitrag im Jahr.',
      'Kinderzulage: 1:1 bis 300 € je Kind mit Kindergeld. Berufseinsteigerbonus: einmalig 200 € unter 25.',
    ],
  },
  bonus: {
    title: 'Berufseinsteigerbonus',
    text: [
      'Einmalig 200 € zusätzliche Zulage, wenn man zu Beginn des Beitragsjahres jünger als 25 ist (§ 84 EStG n. F.). Der Rechner berücksichtigt ihn nur, solange das Alter passt.',
      'Er erhöht nur die Zulage, nicht den Sonderausgabenabzug in der Günstigerprüfung (§ 2 Abs. 6 S. 2 EStG).',
    ],
  },
  guenstiger: {
    title: 'Günstigerprüfung',
    text: [
      'Das Finanzamt prüft automatisch, ob es günstiger ist, die Beiträge samt Zulagen als Sonderausgaben abzuziehen. Spart das mehr Steuern, als die Zulagen wert sind, gibt es die Differenz als zusätzliche Steuererstattung.',
      'Das lohnt sich vor allem bei höherem Einkommen. Ein Teil davon ist nur Steuerstundung, weil die Auszahlung später voll steuerpflichtig ist.',
    ],
  },
  reinvest: {
    title: 'Steuererstattung anlegen',
    text: [
      'Die zusätzliche Steuererstattung aus der Günstigerprüfung landet nicht im Altersvorsorgedepot, sondern auf dem Konto. Für einen fairen Vergleich rechnet der Rechner sie standardmäßig in einem ETF-Nebendepot weiter.',
      'Wird sie ausgegeben, fließt beim AVD netto weniger eigenes Geld hinein als bei den anderen Produkten. Dann gibt es keinen fairen Gewinner.',
    ],
  },
  nebendepot: {
    title: 'ETF-Nebendepot',
    text: ['Ins Altersvorsorgedepot passen höchstens 6.840 € Eigenbeiträge im Jahr (570 € im Monat). Was darüber hinausgeht, und Beiträge aus Jahren ohne Förderberechtigung rechnet der Rechner in einem normalen ETF-Depot. So fließt in jedes Produkt gleich viel eigenes Geld. Der Wert ist beim AVD enthalten.',
      'Beiträge über 150 € im Monat (1.800 € im Jahr) bis zu diesem Höchstbetrag bleiben ungefördert im Vertrag: keine Zulage, kein Steuerabzug, aber auch keine Steuer während der Ansparphase. Bei der Auszahlung ist nur der Gewinnanteil steuerpflichtig, nach 12 Jahren Laufzeit zur Hälfte (§ 22 Nr. 5 S. 2 Buchst. c EStG).'],
  },
  foerderberechtigt: {
    title: 'Förderberechtigt',
    text: [
      'Förderberechtigt ist, wer im Beitragsjahr zumindest zeitweise rentenversicherungspflichtig ist (z. B. Werkstudentenjob, Minijob mit Rentenversicherungspflicht, Berufsstart) oder als Selbstständige oder Selbstständiger unter 67 ist und Gewinneinkünfte aus Gewerbe oder freiberuflicher Tätigkeit hat (§ 10a Abs. 1 S. 5 EStG n. F.).',
      'Ohne Förderberechtigung fließen die AVD-Beiträge im Rechner ins ETF-Nebendepot.',
    ],
  },
  vorabpauschale: {
    title: 'Vorabpauschale',
    text: [
      'Steuer auf einen fiktiven Mindestertrag bei thesaurierenden Fonds, jedes Jahr fällig, auch ohne Verkauf. Grundlage: Fondswert zu Jahresbeginn × Basiszins × 0,7, höchstens die tatsächliche Wertsteigerung.',
      'Bereits gezahlte Vorabpauschale wird beim späteren Verkauf angerechnet. Der Sparerpauschbetrag gilt auch hier.',
    ],
  },
  basiszins: {
    title: 'Basiszins',
    text: ['Vom Bundesfinanzministerium jährlich festgelegter Zins für die Vorabpauschale. 2026: 3,2 % (BMF, 13.01.2026). Für spätere Jahre ist der Wert eine Annahme.'],
  },
  abgeltung: {
    title: 'Abgeltungsteuer, Teilfreistellung, Sparerpauschbetrag',
    text: [
      'Gewinne aus Fonds werden pauschal mit 25 % plus Solidaritätszuschlag besteuert, zusammen 26,375 % (ohne Kirchensteuer).',
      'Bei Aktienfonds sind 30 % der Erträge steuerfrei (Teilfreistellung). Dazu sind 1.000 € Kapitalerträge pro Jahr steuerfrei (Sparerpauschbetrag), im Rechner je Produkt.',
    ],
  },
  ter: {
    title: 'Laufende Kosten (TER)',
    text: ['Jährliche Kosten eines Fonds in Prozent des Vermögens („Total Expense Ratio“). Breite Index-ETFs liegen oft bei 0,1–0,3 %, aktive Fonds deutlich höher.'],
  },
  effektivkosten: {
    title: 'Effektivkosten',
    text: [
      'Alle Kosten eines Vertrags, ausgedrückt als Minderung der jährlichen Rendite. Stehen im Produktinformationsblatt.',
      'Bei Versicherungen sind Abschlusskosten darin über die Laufzeit verteilt. Wer früh kündigt, steht deutlich schlechter da.',
    ],
  },
  avdKosten: {
    title: 'Kosten des Altersvorsorgedepots',
    text: ['Das Standarddepot ist auf 1,0 % Effektivkosten gedeckelt (§ 2a Abs. 2 AltZertG), schichtet aber ab 5 Jahre vor Rentenbeginn in sichere Anlagen um. Das lässt sich unten einschalten („Standarddepot: Umschichtung vor Rentenbeginn“). Für andere Altersvorsorgedepots gibt es keinen Kostendeckel. Ein selbst gewähltes ETF-Depot ist meist günstiger und schichtet nicht um.'],
  },
  standarddepot: {
    title: 'Umschichtung im Standarddepot',
    text: [
      'Das Standarddepot besteht aus zwei Fonds: einem chancenreichen (z. B. Aktien-ETF, Risikoklasse 3–5) und einem sicheren (Risikoklasse 1–2, etwa Geldmarkt oder kurz laufende Anleihen). Fünf Jahre vor der Auszahlphase dürfen höchstens 50 % im chancenreichen Fonds liegen, ab zwei Jahren vorher und zu Beginn der Auszahlphase höchstens 30 % (§ 1 Abs. 1c Nr. 5 AltZertG). Andere Anteile kann man verlangen.',
      'Der Rechner nimmt diese Höchstanteile, stufenweise zu Jahresbeginn, und rechnet den Rest mit der Rendite der sicheren Anlage. Ab Rentenbeginn gilt wie bei allen Produkten die Rendite in der Auszahlphase. Das senkt die Rendite, schützt aber vor einem Kurssturz kurz vor der Rente. Dieser Schutz ist im Kapital nicht sichtbar.',
      'Innerhalb des AVD ist das Umschichten steuerfrei. Im ETF-Depot wäre der Verkauf steuerpflichtig.',
    ],
  },
  ausgabeaufschlag: {
    title: 'Ausgabeaufschlag',
    text: ['Einmalige Gebühr beim Kauf von Fondsanteilen, z. B. 5 % jeder Einzahlung. Bei aktiven Fonds über Bank oder Vermittlung üblich, bei ETFs nicht.'],
  },
  auszahlplan: {
    title: 'Auszahlplan',
    text: [
      'Das Kapital wird bis zu einem festen Alter in Raten entnommen, der Rest bleibt angelegt. Danach ist das Geld aufgebraucht.',
      'Beim Altersvorsorgedepot läuft er mindestens bis 85. Gerechnet wird jedes Jahr Restkapital ÷ Restlaufzeit, die Rate steigt deshalb meist. Gesetzlich muss mindestens 80 % davon gezahlt und die Rate spätestens alle 3 Jahre neu festgelegt werden (§ 1 Abs. 1 Nr. 4 b AltZertG).',
    ],
  },
  einmal: {
    title: '30 % Einmalauszahlung',
    text: ['Beim Altersvorsorgedepot dürfen bei Rentenbeginn bis zu 30 % auf einmal ausgezahlt werden. Das wird in einem Jahr voll versteuert und lohnt sich deshalb meist nicht.'],
  },
  kapitalauszahlung: {
    title: 'Kapitalauszahlung oder Leibrente',
    text: [
      'Kapitalauszahlung: Das Guthaben wird bei Rentenbeginn auf einmal ausgezahlt. Nach 12 Jahren Laufzeit und ab 62 ist die Hälfte des Gewinns (nach 15 % Teilfreistellung) mit dem persönlichen Steuersatz zu versteuern. Im Rechner wird das Geld danach in einen ETF gesteckt und bis zum Ende des Auszahlplans entnommen.',
      'Leibrente: lebenslange Monatsrente, egal wie alt man wird. Versteuert wird nur der Ertragsanteil.',
    ],
  },
  rentenfaktor: {
    title: 'Rentenfaktor',
    text: ['Monatsrente, die die Versicherung je 10.000 € Guthaben zahlt. Steht im Angebot. Wichtig ist, ob er garantiert ist oder später gesenkt werden darf.'],
  },
  garantiezeit: {
    title: 'Rentengarantiezeit',
    text: ['Stirbt man innerhalb dieser Zeit nach Rentenbeginn, wird die Rente bis zu ihrem Ende an die Erben weitergezahlt.'],
  },
  ertragsanteil: {
    title: 'Ertragsanteil',
    text: ['Bei einer privaten Leibrente ist nur ein Teil der Rente steuerpflichtig, abhängig vom Alter bei Rentenbeginn (§ 22 EStG): mit 65 sind es 18 %, mit 67 17 %, mit 70 15 %.'],
  },
  dynamik: {
    title: 'Beitragsdynamik',
    text: ['Die Beiträge steigen jedes Jahr um diesen Prozentsatz, z. B. mit dem Gehalt. Beim Altersvorsorgedepot ist der Teil über 1.800 € im Jahr ungefördert, über 6.840 € im Jahr geht er ins ETF-Nebendepot.'],
  },
  erbfallAvd: {
    title: 'Erbfall beim Altersvorsorgedepot',
    text: [
      'Ehepartner können das Guthaben ohne Abzug auf einen eigenen Vertrag übertragen. Die spätere Einkommensteuer darauf ist grob geschätzt abgezogen.',
      'Erben alle anderen, gilt das AVD als „schädlich verwendet“ (§ 93 EStG): Zulagen und Steuervorteil gehen zurück, die Erträge (Guthaben − eigene Beiträge − Zulagen) werden von den Erben mit ihrem eigenen Steuersatz versteuert (§ 22 Nr. 5 S. 3 EStG).',
    ],
  },
  heirHalf: {
    title: 'Erbe mindestens 62',
    text: ['Die Erben versteuern die Erträge aus dem AVD selbst, mit ihrem eigenen Steuersatz. Nur zur Hälfte, wenn der Erbe bei der Auszahlung mindestens 62 Jahre alt ist und der Vertrag mindestens 12 Jahre lief (BMF-Schreiben vom 05.10.2023, Rn. 148 und 229 f., zur Riester-Rente; für das AVD gilt dieselbe Vorschrift).'],
  },
  incHeir: {
    title: 'Einkommen der Erben',
    text: ['Zu versteuerndes Einkommen der Erben im Todesjahr, in heutigem Geld. Danach richtet sich der Steuersatz auf die AVD-Erträge und auf Restrenten der Versicherung. Standard: 38.000 €.'],
  },
  erbschaftsteuer: {
    title: 'Erbschaftsteuer',
    text: ['Nicht gerechnet. Freibeträge: Ehepartner 500.000 €, Kinder 400.000 €, Partner ohne Trauschein nur 20.000 € (darüber 30 %).'],
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
