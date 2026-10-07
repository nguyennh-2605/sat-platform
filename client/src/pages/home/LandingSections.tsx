import { ArrowRight, BarChart3, BookOpenCheck, ChevronDown, ClipboardList, GraduationCap, Layers, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollReveal } from './ScrollReveal';

const learningSteps = [
  { number: '01', title: 'Practice with purpose.', description: 'Make space for Reading & Writing and Math. Choose a practice test and work through it at your pace.', icon: BookOpenCheck },
  { number: '02', title: 'Make mistakes useful.', description: 'Review your answers, collect mistakes in your Error Log, and write down what you want to remember.', icon: NotebookPen },
  { number: '03', title: 'Find your next step.', description: 'Look at patterns across completed attempts. Return to the skills that need attention and keep building.', icon: BarChart3 },
];

const faqs = [
  { question: 'What can I study with Sonder SAT?', answer: 'Sonder SAT brings Digital SAT Reading & Writing and Math practice, answer review, an Error Log, vocabulary study, and performance analytics into one workspace.' },
  { question: 'Can I use it without joining a class?', answer: 'Yes. Students can use the practice library, Error Log, vocabulary tools, and analytics for independent study. Classroom learning is available when you are enrolled in a class.' },
  { question: 'How do I get started?', answer: 'Create an account or log in to open your dashboard. You can currently use email and password or Google. Then choose a practice test or open a vocabulary set to begin.' },
  { question: 'Is there a workspace for teachers?', answer: 'Yes. Teachers can organize class lessons and materials, publish assignments and tests, review student work, and follow class performance. Create a teacher account to use the classroom tools.' },
];

export function LearningCycle() {
  return (
    <section id="how-it-works" aria-labelledby="cycle-title" className="scroll-mt-24 border-y border-border">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <ScrollReveal className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">A simple learning loop</p><h2 id="cycle-title" className="mt-3 text-3xl font-medium tracking-tight">Practice. Review. Improve.</h2></div>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">A little structure makes it easier to keep moving.</p>
        </ScrollReveal>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0">
          {learningSteps.map(({ number, title, description, icon: Icon }, index) => (
            <li key={number} className="border-t border-border pt-5 md:border-t-0 md:border-l md:px-6 md:pt-0 md:first:border-l-0 md:first:pl-0 md:last:pr-0">
              <ScrollReveal delay={index * 70}>
                <div className="flex items-center justify-between"><span className="text-xs tabular-nums text-muted-foreground">{number}</span><Icon className="size-5" aria-hidden="true" /></div>
                <h3 className="mt-5 text-base font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </ScrollReveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ClassroomSection() {
  return (
    <section aria-labelledby="classroom-title" className="border-b border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-2 md:gap-16">
        <ScrollReveal><GraduationCap className="size-7 stroke-1" aria-hidden="true" /><p className="mt-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">Better together</p><h2 id="classroom-title" className="mt-3 text-3xl font-medium tracking-tight">Independent study.<br />Connected classrooms.</h2><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Study on your own, or learn with your teacher. Lessons, assignments, and feedback have a place alongside your practice.</p><Button asChild variant="link" size="lg" className="mt-4 px-0"><a href="#faq">Learn about getting started<ArrowRight aria-hidden="true" /></a></Button></ScrollReveal>
        <ScrollReveal delay={100}>
          <ul className="flex h-full flex-col justify-center divide-y divide-border">
            {[
              { icon: Layers, title: 'A clear home for class materials', description: 'Lessons, resources, and announcements stay connected.' },
              { icon: ClipboardList, title: 'Assignments with a next step', description: 'Teachers publish work. Students submit it and return to feedback.' },
              { icon: BarChart3, title: 'A shared view of learning', description: 'Teachers follow participation and performance across their class.' },
            ].map(({ icon: Icon, title, description }) => <li className="flex gap-4 py-5 first:pt-0 last:pb-0" key={title}><Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div></li>)}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-3 md:gap-12">
      <ScrollReveal><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">A few things to know</p><h2 id="faq-title" className="mt-3 text-3xl font-medium tracking-tight">Before you begin.</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">A little clarity for your first step.</p></ScrollReveal>
      <ScrollReveal delay={80} className="divide-y divide-border border-y border-border md:col-span-2">
        {faqs.map(({ question, answer }) => (
          <Collapsible key={question}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="lg" className="group h-auto min-h-14 w-full justify-between gap-4 rounded-none px-0 py-4 text-left whitespace-normal hover:bg-transparent">
                <span className="leading-6">{question}</span><ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent><p className="pb-5 pr-8 text-sm leading-6 text-muted-foreground">{answer}</p></CollapsibleContent>
          </Collapsible>
        ))}
      </ScrollReveal>
    </section>
  );
}
