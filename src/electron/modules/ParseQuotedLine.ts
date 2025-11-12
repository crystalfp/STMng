/**
 * Splitter for line that could contain quoted strings
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

/**
 * Line read type
 * @notExported
 */
const Step = {
    start: 		1,
    normal:  	2,
    blank:   	3,
    quoted:   	4,
    endQuoted:  5
} as const;

/**
 * Line read type
 * @notExported
 */
type StepType = (typeof Step)[keyof typeof Step];

/**
 * Line read type
 * @notExported
 */
const Char = {
    normal: 	0,
    blank:   	1,
    quote:   	2,
} as const;
/**
 * Line read type
 * @notExported
 */
type CharType = (typeof Char)[keyof typeof Char];

interface Transition {
	next: StepType;
	action?: (ch: string) => void;
}


type EndAction = (step: StepType) => void;


export class ParseQuotedLine {

	private readonly transitions = new Map<StepType, Map<CharType, Transition>>();
	private readonly finish: Map<StepType, EndAction | undefined>;
	private partial = "";
	private out: string[] = [];

	private save(ch: string): void {

		this.partial += ch;
	}

	private start(ch: string): void {

		this.partial = ch;
	}

	private startEmpty(): void {

		this.partial = "";
	}

	private end(): void {

		this.out.push(this.partial);
		this.partial = "";
	}

	constructor() {

		const nextStart = new Map<CharType, Transition>([
			[Char.normal, {next: Step.normal, action: this.start.bind(this)}],
			[Char.blank,  {next: Step.blank}],
			[Char.quote,  {next: Step.quoted, action: this.startEmpty.bind(this)}],
		]);
		this.transitions.set(Step.start, nextStart);

		const nextNormal = new Map<CharType, Transition>([
			[Char.normal, {next: Step.normal, action: this.save.bind(this)}],
			[Char.blank,  {next: Step.blank,  action: this.end.bind(this)}],
			[Char.quote,  {next: Step.quoted, action: this.end.bind(this)}],
		]);
		this.transitions.set(Step.normal, nextNormal);

		const nextBlank = new Map<CharType, Transition>([
			[Char.normal, {next: Step.normal, action: this.start.bind(this)}],
			[Char.blank,  {next: Step.blank}],
			[Char.quote,  {next: Step.quoted, action: this.startEmpty.bind(this)}],
		]);
		this.transitions.set(Step.blank, nextBlank);

		const nextQuoted = new Map<CharType, Transition>([
			[Char.normal, {next: Step.quoted,    action: this.save.bind(this)}],
			[Char.blank,  {next: Step.quoted,    action: this.save.bind(this)}],
			[Char.quote,  {next: Step.endQuoted, action: this.end.bind(this)}],
		]);
		this.transitions.set(Step.quoted, nextQuoted);

		const nextEndQuoted = new Map<CharType, Transition>([
			[Char.normal, {next: Step.normal,    action: this.start.bind(this)}],
			[Char.blank,  {next: Step.endQuoted, action: this.startEmpty.bind(this)}],
			[Char.quote,  {next: Step.quoted,    action: this.start.bind(this)}],
		]);
		this.transitions.set(Step.endQuoted, nextEndQuoted);

		this.finish = new Map<StepType, EndAction | undefined>([
			[Step.start, 	 undefined],
			[Step.normal, 	 this.end.bind(this)],
			[Step.blank, 	 undefined],
			[Step.quoted, 	 this.end.bind(this)],
			[Step.endQuoted, undefined],
		]);
	}

	/**
	 * Split line into fields (that could be quoted)
	 *
	 * @param line - Line to be parsed
	 * @returns The strings separated by blanks
	 */
	split(line: string): string[] {

		const l2 = line.replaceAll(String.raw`\'`, "⸳").replaceAll(String.raw`\"`, "†");
		// eslint-disable-next-line sonarjs/slow-regex
		const l3 = l2.replaceAll(/(?:^|\s+)["']/g, "|").replaceAll(/["'](?:\s+|$)/g, "|");
		const l4 = l3.replaceAll("⸳", "'").replaceAll("†", '"');

		this.partial = "";
		this.out = [];
		let step: StepType = Step.start;

		for(const ch of l4) {

			// Classify character
			let char: CharType = Char.normal;
			if(ch === "|") char = Char.quote;
			else if(ch === " ") char = Char.blank;

			// Get next step from the transition matrix
			const nextSteps = this.transitions.get(step);
			if(!nextSteps) throw Error(`Invalid step ${step}`);

			const next = nextSteps.get(char);
			if(!next) throw Error(`Invalid next step with char ${char} and step ${step}`);

			// Do the transition
			if(next.action) next.action(ch);
			step = next.next;
		}
		const finalAction = this.finish.get(step);
		if(finalAction) finalAction(step);

		return this.out;
	}
}

/*
const examples = [
  "field1 field2 field3",
  'field1 "field 2" field3',
  "name 'John Doe' age 30",
  '"first field" second "third field"',
  'a "b c d" e "f g" h',
  '  multiple   spaces   "preserved inside"  ',
  "N'3+       0.25136   0.39997   0.18339",
  String.raw`'It\'s a test' another`,
  String.raw`"escaped \"quotes\" inside"`,
];

const parser = new ParseQuotedLine();
for(const line of examples) {

	console.log("\nLINE", line);
	const fields = parser.split(line);
	console.log("OUT:", fields);
}
*/
