const EMPLOYMENT_LABELS: Record<string, string> = {
  minijob: "Minijob",
  teilzeit: "Teilzeit",
  vollzeit: "Vollzeit",
};

interface ContractData {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  employmentType: string;
  companyName: string;
  companyCeoName: string;
  startDate?: string; // already formatted DE
}

export function formatGermanDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function replacePlaceholders(template: string, data: ContractData): string {
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const startDate = data.startDate || today;
  return template
    .replace(/\{\{first_name\}\}/g, data.firstName)
    .replace(/\{\{last_name\}\}/g, data.lastName)
    .replace(/\{\{address\}\}/g, data.address)
    .replace(/\{\{city\}\}/g, data.city)
    .replace(/\{\{employment_type\}\}/g, EMPLOYMENT_LABELS[data.employmentType] ?? data.employmentType)
    .replace(/\{\{company_name\}\}/g, data.companyName)
    .replace(/\{\{company_ceo_name\}\}/g, data.companyCeoName)
    .replace(/\{\{start_date\}\}/g, startDate)
    .replace(/\{\{employment_start_date\}\}/g, startDate)
    .replace(/\{\{date\}\}/g, today);
}

export function generateFallbackContract(data: ContractData): string {
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const startDate = data.startDate || today;
  const isMinijob = data.employmentType === "minijob";
  const company = data.companyName || "[Firmenname]";
  const ceo = data.companyCeoName || "[Geschäftsführer]";

  const titleLine = isMinijob
    ? "ARBEITSVERTRAG\nfür geringfügige Beschäftigung – Minijob"
    : `ARBEITSVERTRAG\n${EMPLOYMENT_LABELS[data.employmentType] ?? data.employmentType}`;

  return `${titleLine}


zwischen
${company}
vertreten durch den Geschäftsführer ${ceo}
– nachfolgend Arbeitgeber – und


${data.firstName} ${data.lastName}
${data.address}

– nachfolgend Arbeitnehmer – wird folgender Arbeitsvertrag geschlossen:


§1 Beginn, Dauer und Beschäftigungsart
1. Das Arbeitsverhältnis beginnt am ${startDate} und wird auf unbestimmte Zeit geschlossen.
2. Die ersten 3 Monate gelten als Probezeit.
3. Die Beschäftigung erfolgt im Rahmen einer geringfügigen Beschäftigung (Minijob) gemäß § 8 SGB IV.
4. Nach erfolgreichem Abschluss der Einarbeitungsphase (in der Regel nach 4–6 Wochen) ist ein Wechsel in eine Teilzeit- oder Vollzeitbeschäftigung möglich. Die Umstellung erfolgt im gegenseitigen Einvernehmen und bedarf einer gesonderten schriftlichen Vereinbarung.


§2 Tätigkeit
1. Der Arbeitnehmer wird als Studienmitarbeiter im Bereich Sicherheits- und Qualitätsanalysen eingesetzt.
2. Die Tätigkeit umfasst insbesondere die Durchführung standardisierter digitaler Studien, das Testen von Registrierungs- und Login-Prozessen, die Prüfung von Funktionen innerhalb von Apps oder Webanwendungen, die Bewertung von Benutzerführung, Performance und Reaktionszeiten, die Dokumentation von Auffälligkeiten, Fehlern und Optimierungspotenzialen sowie die Erstellung strukturierter Kurzberichte.
3. Der Arbeitnehmer ist verpflichtet, die ihm übertragenen Aufgaben sorgfältig, gewissenhaft und entsprechend den Vorgaben des Arbeitgebers auszuführen.
4. Der Arbeitgeber ist berechtigt, dem Arbeitnehmer andere zumutbare Tätigkeiten zuzuweisen, die seinen Kenntnissen und Fähigkeiten entsprechen.


§3 Arbeitsort
1. Die Tätigkeit erfolgt ausschließlich im Homeoffice des Arbeitnehmers.
2. Der Arbeitnehmer hat sicherzustellen, dass die Arbeitsumgebung die Anforderungen an Datenschutz und Vertraulichkeit erfüllt.
3. Ein Anspruch auf einen Arbeitsplatz in den Geschäftsräumen des Arbeitgebers besteht nicht.


§4 Arbeitszeit
1. Die regelmäßige wöchentliche Arbeitszeit richtet sich nach den vom Arbeitgeber bereitgestellten Aufgaben und beträgt in der Regel bis zu 10 Stunden pro Woche.
2. Die Arbeitszeit kann flexibel im Zeitraum Montag bis Sonntag zwischen 08:00 und 20:00 Uhr erbracht werden.
3. Die konkrete Einteilung der Arbeitszeit erfolgt in Abstimmung mit dem Arbeitgeber.
4. Der Arbeitgeber ist bemüht, dem Arbeitnehmer kontinuierlich Aufgaben zur Verfügung zu stellen.
5. Der Arbeitnehmer ist verpflichtet, Beginn, Ende und Dauer seiner täglichen Arbeitszeit vollständig und wahrheitsgemäß zu dokumentieren.
6. Die Arbeitszeit darf im Durchschnitt die Grenzen der geringfügigen Beschäftigung nicht überschreiten.


§5 Vergütung
1. Der Arbeitnehmer erhält eine monatliche Pauschalvergütung in Höhe von 603,00 €.
2. Die Vergütung wird jeweils zum letzten Bankarbeitstag des Monats auf das vom Arbeitnehmer benannte Konto überwiesen.
3. Mit der Vergütung sind etwaige Mehr- und Überstunden abgegolten, soweit diese im Rahmen der vereinbarten Arbeitszeit und der geringfügigen Beschäftigung anfallen.
4. Die Vergütung erfolgt unter Beachtung des jeweils geltenden gesetzlichen Mindestlohns.
5. Der Arbeitnehmer ist verpflichtet, den Arbeitgeber unverzüglich über die Aufnahme weiterer geringfügiger Beschäftigungen zu informieren.


§6 Sonderzahlung (13. Monatsgehalt)
1. Der Arbeitnehmer erhält ein 13. Monatsgehalt in Form eines Weihnachtsgeldes.
2. Die Höhe entspricht einem durchschnittlichen Monatsentgelt.
3. Voraussetzung ist ein ungekündigtes Arbeitsverhältnis zum 30.11. des jeweiligen Jahres.
4. Bei unterjährigem Eintritt erfolgt eine anteilige Gewährung.
5. Die Zahlung erfolgt freiwillig und ohne Begründung eines Rechtsanspruchs für die Zukunft.


§7 Sparplan-Benefit
1. Der Arbeitgeber gewährt einen steuerfreien Sparplan-Benefit gemäß § 3 Nr. 63 EStG.
2. Die Leistung beträgt 50,00 € pro Quartal, maximal 200,00 € pro Jahr.
3. Die Auszahlung erfolgt quartalsweise (März, Juni, September, Dezember).


§8 Urlaub
1. Der Arbeitnehmer hat Anspruch auf den gesetzlichen Mindesturlaub.
2. Bei einer 5-Tage-Woche entspricht dies 20 Arbeitstagen pro Jahr.
3. Bei abweichender Arbeitstageverteilung erfolgt eine anteilige Berechnung.
4. Der Urlaub ist rechtzeitig zu beantragen und mit dem Arbeitgeber abzustimmen.
5. Nicht genommener Urlaub verfällt nach den gesetzlichen Regelungen.


§9 Arbeitsverhinderung und Krankheit
1. Jede Arbeitsverhinderung und deren voraussichtliche Dauer ist dem Arbeitgeber unverzüglich mitzuteilen.
2. Spätestens am 4. Kalendertag der Arbeitsunfähigkeit ist eine ärztliche Bescheinigung vorzulegen.
3. Der Arbeitgeber ist berechtigt, die Vorlage früher zu verlangen.
4. Im Übrigen gelten die gesetzlichen Bestimmungen zur Entgeltfortzahlung.


§10 Nebentätigkeit
1. Nebentätigkeiten sind zulässig, sofern keine berechtigten Interessen des Arbeitgebers beeinträchtigt werden.
2. Eine Tätigkeit bei direkten Wettbewerbern ist unzulässig.
3. Jede weitere geringfügige Beschäftigung ist dem Arbeitgeber vor Aufnahme anzuzeigen.


§11 Datenschutz und Verschwiegenheit
1. Der Arbeitnehmer verpflichtet sich zur Einhaltung der Datenschutz-Grundverordnung (DSGVO).
2. Alle betrieblichen und geschäftlichen Informationen sind vertraulich zu behandeln.
3. Diese Verpflichtung gilt auch über die Beendigung des Arbeitsverhältnisses hinaus.


§12 Arbeitsmittel
1. Der Arbeitgeber stellt dem Arbeitnehmer Firmenlaptop, optional ein Firmen-Smartphone sowie alle erforderliche Software und Systemzugänge zur Verfügung.
2. Die Arbeitsmittel bleiben Eigentum des Arbeitgebers; eine private Nutzung ist nicht gestattet.
3. Der Arbeitnehmer ist verpflichtet, die Arbeitsmittel sorgfältig zu behandeln und vor Zugriff Dritter zu schützen.
4. Bei Verlust oder Beschädigung ist der Arbeitgeber unverzüglich zu informieren.
5. Bei Beendigung des Arbeitsverhältnisses sind alle Arbeitsmittel unverzüglich zurückzugeben.
6. Die Kosten für Anschaffung, Wartung und Betrieb trägt der Arbeitgeber.


§13 Haftung
1. Der Arbeitnehmer haftet für Schäden nur im Rahmen der gesetzlichen Vorschriften.
2. Bei leichter Fahrlässigkeit ist die Haftung in der Regel ausgeschlossen.
3. Bei grober Fahrlässigkeit oder Vorsatz haftet der Arbeitnehmer nach den gesetzlichen Bestimmungen.


§14 Leistungs- und Verhaltenspflichten
1. Der Arbeitnehmer verpflichtet sich zu einer ordnungsgemäßen und qualitativ einwandfreien Durchführung der übertragenen Aufgaben.
2. Wiederholte erhebliche Pflichtverletzungen oder dauerhaft unzureichende Arbeitsqualität können arbeitsrechtliche Maßnahmen bis hin zur Kündigung nach sich ziehen.


§15 Probezeit und Kündigung
1. Während der Probezeit kann das Arbeitsverhältnis mit einer Frist von zwei Wochen gekündigt werden.
2. Nach der Probezeit gelten die gesetzlichen Kündigungsfristen.
3. Die Kündigung bedarf der Schriftform.


§16 Sozialversicherung
Das Arbeitsverhältnis ist eine geringfügige Beschäftigung gemäß § 8 SGB IV. Die Anmeldung erfolgt durch den Arbeitgeber.


§17 Schlussbestimmungen
1. Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform.
2. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Wirksamkeit des Vertrages im Übrigen unberührt.
3. Es gilt deutsches Recht.
4. Gerichtsstand ist der Sitz des Arbeitgebers.


Ort, Datum: ${data.city || ""}, ${today}


${ceo}
Arbeitgeber


${data.firstName} ${data.lastName}
Arbeitnehmer`;
}
