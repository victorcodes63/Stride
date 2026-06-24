'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle,
  UserSearch,
  Building2,
  BookOpen,
  ShieldCheck,
  TrendingUp,
  Globe2,
  Brain,
  ArrowRight,
} from 'lucide-react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import SectionTitle from '@/components/SectionTitle';

const ServicesSection = () => {
  const isDesktop = useIsDesktop();
  const services = [
    {
      id: '1',
      title: 'Recruitment & Executive Search',
      description:
        'Strategic talent acquisition for leadership and specialized roles.',
      icon: UserSearch,
      link: '/services/recruitment',
      span: 'md:col-span-2 md:row-span-2',
    },
    {
      id: '2',
      title: 'HR Outsourcing',
      description:
        'End-to-end HR management aligned with operational efficiency.',
      icon: Building2,
      link: '/services/hr-outsourcing',
      span: 'md:col-span-2',
    },
    {
      id: '3',
      title: 'Training & Development',
      description:
        'Performance-driven learning programs for workforce growth.',
      icon: BookOpen,
      link: '/services/training-development',
      span: 'md:col-span-1',
    },
    {
      id: '4',
      title: 'HR Compliance & Legal',
      description:
        'Regulatory compliance and risk mitigation advisory.',
      icon: ShieldCheck,
      link: '/services/hr-compliance',
      span: 'md:col-span-1',
    },
    {
      id: '5',
      title: 'Salary Surveys',
      description:
        'Market benchmarking for competitive compensation strategies.',
      icon: TrendingUp,
      link: '/services/salary-surveys',
      span: 'md:col-span-2',
    },
    {
      id: '6',
      title: 'EOR Services',
      description:
        'Compliant workforce expansion without entity establishment.',
      icon: Globe2,
      link: '/services/eor-services',
      span: 'md:col-span-1',
    },
    {
      id: '7',
      title: 'Psychometric Assessments',
      description:
        'Data-driven evaluation for hiring and leadership insights.',
      icon: Brain,
      link: '/services/psychometric-assessments',
      span: 'md:col-span-1',
    },
  ];

  return (
    <section className="mt-8 py-20 bg-neutral-50">
      <div className="container mx-auto px-4">

        {/* Header */}
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.6 : 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <SectionTitle
            label="Our services"
            title="Comprehensive HR solutions"
            titleLine2="tailored to your needs."
            subtitle="Designed to strengthen workforce performance, compliance, and long-term organisational growth."
            variant="section"
            className="mb-8"
          />
        </motion.div>

        {/* Bento Grid */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[220px] gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              const isHeroCard = service.span.includes('row-span-2');
              const isRecruitmentCard = service.id === '1';

              return (
                <Link
                  key={service.id}
                  href={service.link}
                  className={`block ${service.span}`}
                >
                  <motion.div
                    initial={isDesktop ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    whileHover={isDesktop ? { y: -4 } : undefined}
                    transition={{ duration: isDesktop ? 0.5 : 0, delay: isDesktop ? index * 0.05 : 0 }}
                    viewport={{ once: true }}
                    className={`group relative h-full rounded-2xl border transition-all duration-300 ${
                      isRecruitmentCard
                        ? 'border-neutral-200 bg-white shadow-xl overflow-hidden'
                        : isHeroCard
                        ? 'border-primary-900 bg-primary-900 text-white shadow-xl'
                        : 'border-neutral-200 bg-white hover:shadow-lg'
                    }`}
                  >
                    <div
                      className={`relative z-10 flex h-full flex-col justify-between ${
                        isHeroCard ? 'p-8' : 'p-6'
                      }`}
                    >
                      {!isRecruitmentCard && (
                        <div
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${
                            isHeroCard
                              ? 'bg-white/10 border border-white/20'
                              : 'bg-secondary-50 border border-secondary-200'
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              isHeroCard ? 'text-white' : 'text-secondary-500'
                            }`}
                          />
                        </div>
                      )}
                      {isRecruitmentCard && (
                        <>
                          <div className="space-y-3">
                            <div
                              className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-50 border border-secondary-200`}
                            >
                              <Icon className="h-5 w-5 text-secondary-500" />
                            </div>
                            <h3 className="font-heading font-semibold leading-tight text-xl">
                              {service.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-neutral-600">
                              {service.description}
                            </p>
                            <div className="inline-flex items-center text-sm font-semibold text-primary-800 hover:text-secondary-600 transition-colors">
                              Learn More
                              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </div>
                          </div>
                          <div className="relative -mx-8 mt-6 -mb-8 h-[44%] min-h-[180px] max-h-[240px] overflow-hidden bg-white flex items-center justify-center">
                            <Image
                              src="/images/about/vecteezy_business-meeting-illustration_71267549.jpg"
                              alt="Recruitment and executive search"
                              fill
                              className="object-cover object-[50%_center] transition-transform duration-700 lg:group-hover:scale-[1.03]"
                            />
                            <div className="absolute inset-0 bg-primary-900/12 pointer-events-none" />
                          </div>
                        </>
                      )}
                      {!isRecruitmentCard && (
                        <div className="space-y-3">
                          <h3
                            className={`font-heading font-semibold leading-tight ${
                              isHeroCard
                                ? 'text-2xl md:text-3xl'
                                : 'text-xl'
                            }`}
                          >
                            {service.title}
                          </h3>

                          <p
                            className={`text-sm leading-relaxed ${
                              isHeroCard
                                ? 'text-white/80'
                                : 'text-neutral-600'
                            }`}
                          >
                            {service.description}
                          </p>

                          <div
                            className={`inline-flex items-center text-sm font-semibold ${
                              isHeroCard
                                ? 'text-white hover:text-white/80'
                                : 'text-primary-800 hover:text-secondary-600'
                            } transition-colors`}
                          >
                            Learn More
                            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.6 : 0 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-md">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">

              {/* Left: Text */}
              <div className="p-8 lg:p-10 flex flex-col justify-center order-2 lg:order-1">
                <h3 className="text-2xl lg:text-3xl font-heading font-bold text-primary-900 mb-4">
                  Ready to Strengthen Your HR Framework?
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  Partner with us to build scalable HR systems that
                  enhance performance, ensure compliance, and support
                  sustainable business growth.
                </p>
              </div>

              {/* Middle: Image */}
              <div className="relative h-56 lg:h-auto lg:min-h-[380px] order-1 lg:order-2">
                <Image
                  src="/images/about/Smiling%20African%20American%20Woman%20Business%20Suit.PNG"
                  alt="Professional HR consultation"
                  fill
                  className="object-cover object-top scale-80"
                />
              </div>

              {/* Right: CTA & Buttons */}
              <div className="p-8 lg:p-10 flex flex-col justify-center order-3 lg:order-3">
                <p className="text-xl lg:text-2xl font-semibold text-secondary-500 mb-6">Take the next step</p>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-4">
                  <Link
                    href="/services"
                    className="bg-primary-900 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-800 transition text-center"
                  >
                    View All Services
                  </Link>
                  <Link
                    href="/contact"
                    className="border border-primary-900 text-primary-900 px-8 py-4 rounded-lg font-semibold hover:bg-primary-900 hover:text-white transition text-center"
                  >
                    Schedule Consultation
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default ServicesSection;
