import { Hero } from '@/components/hero/Hero';
import { FeaturedWork } from '@/components/projects/FeaturedWork';
import { AllWork } from '@/components/projects/AllWork';
import { Expertise, Process, Experience } from '@/components/sections/Sections';
import { About } from '@/components/hero/About';
import { Testimonials } from '@/components/sections/Testimonials';
import { Contact, SiteFooter } from '@/components/footer/Footer';

/**
 * One-page flow (recruiter questions, in order):
 * Who are you? → best work → all work → what else can you do → how do you work →
 * background → experience → what others say → how to contact you.
 */
export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeaturedWork />
      <AllWork />
      <Expertise />
      <Process />
      <About />
      <Experience />
      <Testimonials />
      <Contact />
      <SiteFooter />
    </main>
  );
}
