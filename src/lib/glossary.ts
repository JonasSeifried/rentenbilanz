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
  gehaltsentwicklung: {
    title: 'Gehaltsentwicklung',
    text: [
      'Das Gehalt bestimmt den Steuersatz in der Sparphase und damit vor allem die Steuererstattung beim Altersvorsorgedepot: Je höher das Gehalt, desto mehr bringt der Sonderausgabenabzug über die Zulagen hinaus.',
      'Ohne diese Angabe bleibt das Gehalt das ganze Berufsleben real gleich. Mit ihr steigt (oder sinkt) es ab Berufsbeginn (ohne Ausbildung: ab heute) jedes Jahr um denselben Prozentsatz bis zum Zielgehalt und bleibt danach gleich. Ist Start- oder Zielgehalt 0 €, steigt es stattdessen jedes Jahr um denselben Betrag. Beträge in heutigem Geld, also ohne Inflationsausgleich.',
      'Die Monatsbeiträge steigen dadurch nicht automatisch mit. Dafür gibt es die Beitragsdynamik bei den Produkten.',
    ],
  },
  incRet: {
    title: 'Einkommen im Alter',
    text: [
      'Steuerpflichtiges Einkommen im Ruhestand ohne die hier verglichenen Produkte, zum Beispiel gesetzliche Rente, Betriebsrente oder Mieteinnahmen. Bei Rentenbeginn ab 2058 ist die gesetzliche Rente voll steuerpflichtig.',
      'Dieser Wert ist das zu versteuernde Einkommen ohne die verglichenen Produkte. Beiträge zur Kranken- und Pflegeversicherung auf dieses bisherige Einkommen sind darin bereits abgezogen. Zusätzliche Beiträge auf die verglichenen Produkte zieht der Rechner gesondert ab. Betrag in heutigem Geld.',
      'Die Renteninformation nennt eine Bruttorente, kein zu versteuerndes Einkommen. Unter dem Feld lässt es sich aus der Bruttorente berechnen („Einkommen im Alter aus der Bruttorente berechnen“). Sonstige KV-beitragspflichtige Bruttoeinnahmen werden unter Weitere Einstellungen getrennt eingegeben.',
    ],
  },
  renteZve: {
    title: 'Von der Bruttorente zum zu versteuernden Einkommen',
    text: [
      'Steuerpflichtig ist nur der Besteuerungsanteil der Rente; er hängt vom Jahr des Rentenbeginns ab: 2026 84 %, danach jedes Jahr 0,5 Prozentpunkte mehr, ab 2058 100 % (§ 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. aa EStG). Der Rest ist der Rentenfreibetrag. Er bleibt für die ganze Rentenzeit in Euro gleich; Rentenerhöhungen sind voll steuerpflichtig.',
      'Abgezogen werden 102 € Werbungskosten-Pauschbetrag (§ 9a S. 1 Nr. 3 EStG), 36 € Sonderausgaben-Pauschbetrag (§ 10c EStG) und die Kranken- und Pflegeversicherung auf die Rente (§ 10 Abs. 1 Nr. 3 EStG). Gesetzlich Versicherte tragen die Hälfte von 14,6 % und vom Zusatzbeitrag (§ 249a SGB V), die Pflegeversicherung allein (§ 59 Abs. 1 SGB XI).',
      'In heutigem Geld wächst die Rente mit der Inflation. Feste Euro-Beträge (Freibetrag, Pauschbeträge) werden dadurch real kleiner, das zu versteuernde Einkommen steigt über die Rentenjahre. Vorgeschlagen wird der Durchschnitt bis zum Ende des Auszahlplans, auf 100 € gerundet.',
      'Nicht berücksichtigt: tatsächliche Rentenerhöhungen über der Inflation, Abschläge oder Zuschläge bei einem Rentenbeginn vor oder nach der Regelaltersgrenze (die Renteninformation nennt die Rente zur Regelaltersgrenze), Steuerermäßigungen, Ehegattensplitting.',
    ],
  },
  sparerGenutzt: {
    title: 'Sparer-Pauschbetrag schon genutzt',
    text: [
      'Kapitalerträge bis 1.000 € im Jahr sind steuerfrei (§ 20 Abs. 9 EStG), aber nur einmal für alle Konten und Depots zusammen. Zinsen auf Tagesgeld, Dividenden oder Gewinne aus anderen Depots verbrauchen ihn zuerst; für die hier verglichenen Depots bleibt dann weniger.',
      'Einzutragen ist, wie viel davon andere Kapitalerträge im Jahr verbrauchen (nach Teilfreistellung), höchstens 1.000 €; zusammen veranlagt gilt der gemeinsame Pauschbetrag von 2.000 €, dann bis 2.000 € für beide zusammen. Die Jahressteuerbescheinigung jeder Bank nennt den „in Anspruch genommenen Sparer-Pauschbetrag“; die Summe über alle Banken ist der Wert.',
      'Betrag in heutigem Geld: Er wächst im Modell mit der Inflation, der Pauschbetrag bleibt nominal 1.000 €. Dadurch ist er später stärker verbraucht als heute. Gilt in Anspar- und Auszahlphase. Die Erben haben im Modell ihren eigenen vollen Pauschbetrag. Ist „Verheiratet, zusammen veranlagt“ eingeschaltet und erbt der Partner, gilt im Todesjahr der gemeinsame Pauschbetrag abzüglich des hier eingetragenen Betrags; ohne diesen Schalter rechnet auch ein erbender Ehepartner mit vollen 1.000 €, obwohl sein Pauschbetrag durch ein mitgeerbtes Tagesgeld in Wirklichkeit teilweise verbraucht sein kann.',
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
      'Abstände zwischen den Produkten werden immer in heutiger Kaufkraft gerechnet. In knappen Fällen kann ein Produkt, das in heutiger Kaufkraft mehr auszahlt, in der nominalen Ansicht die kleinere Summe zeigen.',
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
      'Eine zusätzliche Erstattung gibt es vor allem bei höherem Einkommen. Ein Teil davon ist nur Steuerstundung, weil die Auszahlung später voll steuerpflichtig ist.',
    ],
  },
  reinvest: {
    title: 'Steuererstattung anlegen',
    text: [
      'Die zusätzliche Steuererstattung aus der Günstigerprüfung landet nicht im Altersvorsorgedepot, sondern auf dem Konto. Für einen fairen Vergleich rechnet der Rechner sie standardmäßig in einem ETF-Nebendepot weiter.',
      'Wird sie ausgegeben, fließt beim AVD netto weniger eigenes Geld hinein als bei den anderen Produkten. Dann ist kein fairer Vergleich möglich.',
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
      'Gewinne aus Fonds werden pauschal mit 25 % plus Solidaritätszuschlag besteuert, zusammen 26,375 %. Mit Kirchensteuer sinkt die 25-%-Steuer etwas, dafür kommt die Kirchensteuer dazu: zusammen 27,995 % bei 9 % und 27,819 % bei 8 % (§ 32d Abs. 1 EStG).',
      'Bei Aktienfonds sind 30 % der Erträge steuerfrei (Teilfreistellung). Dazu sind 1.000 € Kapitalerträge pro Jahr steuerfrei (Sparerpauschbetrag; zusammen veranlagte Ehepaare 2.000 €), im Rechner je Produkt.',
    ],
  },
  ter: {
    title: 'Laufende Kosten (TER)',
    text: ['Jährliche Kosten eines Fonds in Prozent des Vermögens („Total Expense Ratio“). Breite Index-ETFs liegen oft bei 0,1–0,3 %, aktive Fonds deutlich höher.'],
  },
  erbfallVersicherung: {
    title: 'Erbfall bei der Versicherung',
    text: [
      'Stirbt die versicherte Person vor Rentenbeginn, zahlt die Versicherung das Fondsguthaben, mindestens aber die eingezahlten Beiträge (Beitragsrückgewähr, bei fondsgebundenen Rentenversicherungen üblich). Die Leistung ist einkommensteuerfrei, es kann nur Erbschaftsteuer anfallen. Prüfe im Angebot, ob dein Vertrag diese Mindestleistung hat.',
      'Das Guthaben ist mit einem festen Kostenabzug von der Rendite gerechnet. Bei Provisionstarifen fallen die Kosten aber vor allem am Beitrag und in den ersten Jahren an. In den ersten 10 bis 20 Jahren ist das Guthaben hier deshalb eher zu hoch, bei einem geprüften Angebot um bis zu ein Viertel. Bei Rentenbeginn passt es wieder.',
      'Nach Rentenbeginn erhalten die Erben nur die restlichen Renten der Garantiezeit; bei Kapitalauszahlung das Depot, in das sie angelegt ist.',
    ],
  },
  effektivkosten: {
    title: 'Effektivkosten',
    text: [
      'Alle Kosten eines Vertrags, ausgedrückt als Minderung der jährlichen Rendite. Stehen im Produktinformationsblatt.',
      'Bei Versicherungen sind Abschlusskosten darin über die Laufzeit verteilt. Wer früh kündigt, steht deutlich schlechter da.',
      'Gerechnet wird mit einem festen Abzug von der Rendite. Das trifft das Kapital bei Rentenbeginn gut. Bei Provisionstarifen fallen die Kosten aber vor allem am Beitrag und in den ersten Jahren an. Das Guthaben vor Rentenbeginn, etwa im Erbfall, ist dann in den ersten 10 bis 20 Jahren eher zu hoch gerechnet. Bei einem geprüften Angebot (0,88 % Effektivkosten) waren es bis zu ein Viertel.',
    ],
  },
  avdKosten: {
    title: 'Kosten des Altersvorsorgedepots',
    text: ['Das Standarddepot ist bis zum Beginn der Auszahlphase auf 1,0 % Effektivkosten gedeckelt (§ 2a Abs. 1–2 AltZertG). Für die Auszahlung sind eigene Kosten einstellbar; standardmäßig wird die Ansparquote weiterverwendet. Es schichtet aber ab 5 Jahre vor Rentenbeginn in sichere Anlagen um. Die Umschichtung lässt sich unter „Markt“ einschalten, dann für alle Produkte gleich. Für andere Altersvorsorgedepots gibt es keinen Kostendeckel. Ein selbst gewähltes Altersvorsorgedepot ist meist günstiger und muss nicht umschichten.'],
  },
  standarddepot: {
    title: 'Umschichtung im Standarddepot',
    text: [
      'Das Standarddepot besteht aus zwei Fonds: einem chancenreichen (z. B. Aktien-ETF, Risikoklasse 3–5) und einem sicheren (Risikoklasse 1–2, etwa Geldmarkt oder kurz laufende Anleihen). Fünf Jahre vor der Auszahlphase dürfen höchstens 50 % im chancenreichen Fonds liegen, ab zwei Jahren vorher und zu Beginn der Auszahlphase höchstens 30 % (§ 1 Abs. 1c Nr. 5 AltZertG). Andere Anteile kann man verlangen.',
      'Mit „Vor Rentenbeginn in sichere Anlagen umschichten“ (unter „Markt“) rechnet der Rechner diese Höchstanteile, stufenweise zu Jahresbeginn, für alle Produkte. Innerhalb des AVD und der Versicherung ist das Umschichten steuerfrei. Im ETF-Depot und im aktiven Fonds ist jeder Verkauf steuerpflichtig.',
    ],
  },
  ausgabeaufschlag: {
    title: 'Ausgabeaufschlag',
    text: ['Die Eingabe zieht Kaufkosten als Anteil vom Bruttobeitrag ab: Bei 5 % werden von 100 € Beitrag 95 € angelegt. Nennt ein Prospekt dagegen 5 % Aufschlag auf den Nettoanteilswert, entspricht das rund 4,762 % dieser Eingabe (5 ÷ 105). Die Bezugsgröße im Prospekt prüfen.'],
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
    text: ['Beim Altersvorsorgedepot dürfen bei Rentenbeginn bis zu 30 % auf einmal ausgezahlt werden. Dieser Betrag wird in einem einzigen Jahr voll versteuert. Durch den progressiven Tarif ist die Steuer darauf meist höher als bei Auszahlung über den Auszahlplan.'],
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
  umschichtung: {
    title: 'Umschichtung vor Rentenbeginn',
    text: [
      'Eingeschaltet schichten alle Produkte wie das Standarddepot um: ab 5 Jahre vor Rentenbeginn 50 %, ab 2 Jahren 30 % in Aktien, der Rest in einer sicheren Anlage mit der angegebenen Rendite (§ 1 Abs. 1c Nr. 5 AltZertG). Neue Beiträge werden ebenso aufgeteilt; zu Beginn jedes Jahres wird auf diese Anteile zurückgesetzt. Ab Rentenbeginn rechnen alle Produkte mit der Rendite in der Auszahlphase, die Aufteilung bleibt.',
      'Altersvorsorgedepot und Versicherung schichten innerhalb des Vertrags um, ohne Steuer. ETF-Depot, aktiver Fonds und das AVD-Nebendepot verkaufen dafür Anteile: Der Gewinn wird mit Abgeltungsteuer versteuert, 30 % sind frei (Teilfreistellung für Aktienfonds), der Sparer-Pauschbetrag von 1.000 € (zusammen veranlagt 2.000 €) gilt im Jahr für alle Depots zusammen. Der sichere Teil liegt in einem Anleihe- oder Geldmarkt-ETF ohne Teilfreistellung; seine Vorabpauschale und Gewinne sind voll steuerpflichtig, bei freiwillig Versicherten auch voll beitragspflichtig.',
      'Vereinfacht: Der Gewinn je Verkauf ist anteilig nach den durchschnittlichen Anschaffungskosten gerechnet. Gesetzlich gelten die zuerst gekauften Anteile als zuerst verkauft; dann fällt die Steuer etwas früher an, bei Standardwerten macht das unter 1 % der Summe aus. Verluste beim Umschichten werden nicht verrechnet, die Steuer ist dann eher zu hoch.',
    ],
  },
  erbfallKombi: {
    title: 'Erbfall bei einer Kombi',
    text: [
      'Die Erben bekommen alle Teile zusammen und versteuern sie gemeinsam: AVD-Erträge, der Gewinn des ungeförderten AVD-Teils und die erste Restrente der Versicherung zählen im Todesjahr in einem Steuertarif. Das kann mehr Steuer kosten als bei jedem Teil für sich.',
      'Die Depots (ETF, aktiver Fonds, AVD-Nebendepot) übernehmen die Erben mit den ursprünglichen Anschaffungskosten (§ 20 Abs. 4 S. 6 EStG, § 19 Abs. 1 InvStG). Gerechnet ist ein Verkauf im Todesjahr mit einem Sparer-Pauschbetrag von 1.000 € für alle Depots zusammen (erbt der zusammen veranlagte Ehepartner: 2.000 € abzüglich des anderweitig genutzten Betrags und Splittingtarif im Todesjahr, auch bei den Einzelprodukten). Gerechnet ist eine Person als Erbe; mehrere Erben hätten jeder einen eigenen Tarif und Pauschbetrag.',
      'Die Versicherung zahlt vor Rentenbeginn das Fondsguthaben aus, ohne Einkommensteuer (§ 20 Abs. 1 Nr. 6 EStG erfasst nur den Erlebensfall und den Rückkauf).',
    ],
  },
  heirHalf: {
    title: 'Erbe mindestens 62',
    text: ['Die Erben versteuern die Erträge aus dem AVD selbst, mit ihrem eigenen Steuersatz. Nur zur Hälfte, wenn der Erbe bei der Auszahlung mindestens 62 Jahre alt ist und der Vertrag mindestens 12 Jahre lief (BMF-Schreiben vom 05.10.2023, Rn. 148 und 229 f., zur Riester-Rente; für das AVD gilt dieselbe Vorschrift).'],
  },
  incHeir: {
    title: 'Einkommen der Erben',
    text: ['Zu versteuerndes Einkommen der Erben im Todesjahr, in heutigem Geld. Danach richtet sich der Steuersatz auf AVD-Erträge und Restrenten sowie die gemeinsame Günstigerprüfung beim Depotverkauf. Standard: 38.000 €.'],
  },
  kirchensteuer: {
    title: 'Kirchensteuer',
    text: [
      '8 % der Einkommensteuer in Bayern und Baden-Württemberg, 9 % in den übrigen Ländern. Sie fällt auf alles an, was der Einkommensteuer unterliegt: Auszahlungen aus Altersvorsorgedepot und Versicherung, Kapitalerträge und Vorabpauschale.',
      'Die gezahlte Kirchensteuer ist eine Sonderausgabe und senkt die Einkommensteuer etwas (über 36 € im Jahr, Ehepaare 72 €). Das ist gerechnet; das eingegebene zu versteuernde Einkommen gilt vor diesem Abzug. Bringt beim Altersvorsorgedepot der Sonderausgabenabzug mehr als die Zulage, sinkt die Kirchensteuer um den Satz mal der Steuerersparnis über der Zulage.',
      'Nicht gerechnet: die Kappung auf einen Höchstsatz des Einkommens (auf Antrag, nur bei hohen Einkommen), Kinderfreibeträge in der Bemessung und das Kirchgeld, wenn nur ein Ehepartner Mitglied ist. Bei Verheirateten gilt der Satz für beide. Erben zahlen im Rechner denselben Satz.',
    ],
  },
  splitting: {
    title: 'Verheiratet, zusammen veranlagt',
    text: [
      'Ehepaare zahlen die Einkommensteuer gemeinsam auf beide Einkommen (Splittingtarif): Steuer auf die Hälfte, mal zwei. Verdient der Partner weniger, sinkt der Steuersatz, bei der Steuererstattung des Altersvorsorgedepots in der Ansparphase wie auf die Auszahlungen im Alter. Dazu gibt es 2.000 € Sparerpauschbetrag statt 1.000 € und eine doppelte Freigrenze beim Solidaritätszuschlag.',
      'Gerechnet wird mit dem zu versteuernden Einkommen des Partners vor und ab deinem Rentenbeginn, in heutigem Geld. Angenommen: Der Partner hat keine eigenen Kapitalerträge außer dem unter „Sparer-Pauschbetrag schon genutzt“ eingetragenen gemeinsamen Verbrauch und keinen eigenen geförderten Vertrag. Hat er einen, bekäme er unter Umständen selbst eine Zulage (als mittelbar Berechtigter bis 175 € im Jahr, ab 120 € eigenem Beitrag) und die Günstigerprüfung umfasst beide Verträge. Das ist nicht gerechnet.',
      'Die Krankenversicherung bleibt je Person. Andere Erben versteuern im Grundtarif mit ihrem eigenen Einkommen. Erbt der Partner, ist das Todesjahr noch gemeinsam veranlagt (Splitting, 2.000 €, mit seinem Einkommen); die spätere Steuer auf ein übernommenes Altersvorsorgedepot ist mit seinem Einkommen im Alter im Grundtarif geschätzt.',
    ],
  },
  erbschaftsteuer: {
    title: 'Erbschaftsteuer',
    text: ['Nicht gerechnet. Freibeträge: Ehepartner 500.000 €, Kinder 400.000 €, Partner ohne Trauschein nur 20.000 € (darüber 30 %).'],
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
