/**
 * Splitter for line that could contain quoted strings
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Step kind
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
 * Step field type
 * @notExported
 */
type StepType = (typeof Step)[keyof typeof Step];

/**
 * Kind of character read
 * @notExported
 */
const Char = {
    normal:	0,
    blank:  1,
    quote:  2,
} as const;

/**
 * Character kind field type
 * @notExported
 */
type CharType = (typeof Char)[keyof typeof Char];

/**
 * Transition table
 * @notExported
 */
interface Transition {
	/** Next step */
	next: StepType;
	/** Action for these step */
	action?: (ch: string) => void;
}

/**
 * Action for the finish step
 * @notExported
 */
type EndAction = (step: StepType) => void;

/**
 * Parse a line into fields separated by blanks.
 * The field could be quoted and contain blanks
 */
export class ParseQuotedLine {

	private readonly transitions = new Map<StepType, Map<CharType, Transition>>();
	private readonly finish: Map<StepType, EndAction | undefined>;
	private partial = "";
	private out: string[] = [];

	/**
	 * Add character to field
	 *
	 * @param ch - Character to add to the partial read field
	 */
	private save(ch: string): void {

		this.partial += ch;
	}

	/**
	 * Start a new field
	 *
	 * @param ch - Character to start the partial read field
	 */
	private start(ch: string): void {

		this.partial = ch;
	}

	/**
	 * Empty a field
	 */
	private startEmpty(): void {

		this.partial = "";
	}

	/**
	 * End a field and add to the read fields list
	 */
	private end(): void {

		this.out.push(this.partial);
		this.partial = "";
	}

	/**
	 * Initialize the state machine
	 */
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
	 * Split line into fields (that could be quoted) separated by blanks
	 *
	 * @param line - Line to be parsed
	 * @returns The strings list
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
