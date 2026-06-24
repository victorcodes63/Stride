'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { IconTargetArrow, IconChartHistogram, IconUsersGroup, IconHeartHandshake } from '@tabler/icons-react';
import Link from 'next/link';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import SectionTitle from '@/components/SectionTitle';

const SlidingHRQuestions = () => {
  const isDesktop = useIsDesktop();
  const [isVisible, setIsVisible] = useState(false);

  // HR Questions organized in three rows
  const hrQuestions = {
    row1: [
      "How do I build a strong employer brand?",
      "What are the latest HR compliance requirements?",
      "How do I reduce employee turnover?",
      "What's the best recruitment strategy?",
      "How do I handle difficult conversations?",
      "What are effective performance management techniques?",
      "How do I create an inclusive workplace?",
      "What's the ROI of HR technology?"
    ],
    row2: [
      "How do I attract top talent?",
      "What's the best onboarding process?",
      "How do I manage remote teams?",
      "What are the key HR metrics to track?",
      "How do I develop leadership skills?",
      "What's the future of HR?",
      "How do I handle workplace conflicts?",
      "What are the benefits of HR outsourcing?"
    ],
    row3: [
      "How do I create effective HR policies?",
      "What's the best way to conduct interviews?",
      "How do I measure employee engagement?",
      "What are the latest labor law changes?",
      "How do I build a diverse workforce?",
      "What's the impact of AI on HR?",
      "How do I create career development paths?",
      "What are the costs of poor HR practices?"
    ]
  };

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="py-16 md:py-20 bg-gradient-to-br from-neutral-50 via-white to-primary-50 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 26, 0],
            y: [0, -16, 0],
            ...(isDesktop ? { scale: [1, 1.2, 1] } : {}),
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-20 -left-24 h-[22rem] w-[22rem] rounded-full bg-secondary-500/30 blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, -24, 0],
            y: [0, 14, 0],
            ...(isDesktop ? { scale: [1.1, 1, 1.1] } : {}),
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute right-10 top-10 h-72 w-72 rounded-full bg-primary-300/30 blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, 16, 0],
            y: [0, -12, 0],
            ...(isDesktop ? { scale: [1, 1.18, 1] } : {}),
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute left-10 bottom-20 h-52 w-52 rounded-full bg-secondary-400/26 blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, -18, 0],
            y: [0, 18, 0],
            ...(isDesktop ? { scale: [1.1, 1, 1.1] } : {}),
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -bottom-16 right-20 h-60 w-60 rounded-full bg-primary-200/32 blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Section */}
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.8 : 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: isDesktop ? 0.6 : 0, delay: isDesktop ? 0.2 : 0 }}
            viewport={{ once: true }}
          >
            <SectionTitle
              label="HR Questions"
              title="Removing the roadblocks to"
              titleLine2="your HR success."
              subtitle="We filter out the noise, focus on what truly matters, and give you the kind of clarity that lets your organisation shine in the market."
              variant="section"
              className="mb-8"
            />
          </motion.div>
        </motion.div>

        {/* Sliding Questions Section */}
        <div className="relative mb-20">
          {/* Row 1 - Sliding Left to Right */}
          <div className="relative overflow-hidden mb-8">
            <motion.div
              animate={{ x: isVisible ? [0, -100, 0] : 0 }}
              transition={{ 
                duration: 25,
                repeat: Infinity,
                ease: "linear"
              }}
              className="flex space-x-4"
            >
              {[...hrQuestions.row1, ...hrQuestions.row1].map((question, index) => (
                <motion.div
                  key={`row1-${index}`}
                  whileHover={isDesktop ? { scale: 1.05, y: -2 } : undefined}
                  className="flex-shrink-0 bg-gradient-to-r from-slate-100 to-gray-200 text-primary-900 px-4 py-3 md:px-6 md:py-4 rounded-xl font-medium text-xs md:text-sm whitespace-nowrap shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  {question}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Row 2 - Sliding Right to Left */}
          <div className="relative overflow-hidden mb-8">
            <motion.div
              animate={{ x: isVisible ? [0, 100, 0] : 0 }}
              transition={{ 
                duration: 30,
                repeat: Infinity,
                ease: "linear"
              }}
              className="flex space-x-4"
            >
              {[...hrQuestions.row2, ...hrQuestions.row2].map((question, index) => (
                <motion.div
                  key={`row2-${index}`}
                  whileHover={isDesktop ? { scale: 1.05, y: -2 } : undefined}
                  className="flex-shrink-0 bg-gradient-to-r from-blue-100 to-sky-200 text-primary-900 px-4 py-3 md:px-6 md:py-4 rounded-xl font-medium text-xs md:text-sm whitespace-nowrap shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  {question}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Row 3 - Sliding Left to Right */}
          <div className="relative overflow-hidden">
            <motion.div
              animate={{ x: isVisible ? [0, -80, 0] : 0 }}
              transition={{ 
                duration: 28,
                repeat: Infinity,
                ease: "linear"
              }}
              className="flex space-x-4"
            >
              {[...hrQuestions.row3, ...hrQuestions.row3].map((question, index) => (
                <motion.div
                  key={`row3-${index}`}
                  whileHover={isDesktop ? { scale: 1.05, y: -2 } : undefined}
                  className="flex-shrink-0 bg-gradient-to-r from-indigo-100 to-blue-200 text-primary-900 px-4 py-3 md:px-6 md:py-4 rounded-xl font-medium text-xs md:text-sm whitespace-nowrap shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  {question}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Value Proposition Grid */}
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 50 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.8 : 0, delay: isDesktop ? 0.4 : 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {/* Feature 1 */}
          <motion.div
            whileHover={isDesktop ? { scale: 1.05, y: -5 } : undefined}
            className="text-center group"
          >
            <motion.div
              whileHover={isDesktop ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 bg-secondary-50 border border-secondary-200 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg group-hover:border-secondary-300 transition-all duration-300"
            >
              <IconTargetArrow className="w-8 h-8 text-secondary-500" stroke={1.7} />
            </motion.div>
            
            <h3 className="text-xl font-heading font-bold text-primary-900 mb-3">
              We Make HR Simple
            </h3>
            
            <p className="text-neutral-600 leading-relaxed">
              No jargon, no overcomplication — just clear HR strategies you can follow 
              to build and grow your organization confidently.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            whileHover={isDesktop ? { scale: 1.05, y: -5 } : undefined}
            className="text-center group"
          >
            <motion.div
              whileHover={isDesktop ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 bg-secondary-50 border border-secondary-200 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg group-hover:border-secondary-300 transition-all duration-300"
            >
              <IconChartHistogram className="w-8 h-8 text-secondary-500" stroke={1.7} />
            </motion.div>
            
            <h3 className="text-xl font-heading font-bold text-primary-900 mb-3">
              We Focus on Real Results
            </h3>
            
            <p className="text-neutral-600 leading-relaxed">
              Every HR strategy we create is designed to help you hire faster, 
              retain better, and increase productivity.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            whileHover={isDesktop ? { scale: 1.05, y: -5 } : undefined}
            className="text-center group"
          >
            <motion.div
              whileHover={isDesktop ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 bg-secondary-50 border border-secondary-200 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg group-hover:border-secondary-300 transition-all duration-300"
            >
              <IconUsersGroup className="w-8 h-8 text-secondary-500" stroke={1.7} />
            </motion.div>
            
            <h3 className="text-xl font-heading font-bold text-primary-900 mb-3">
              We Know What Works
            </h3>
            
            <p className="text-neutral-600 leading-relaxed">
              With close to a decade of hands-on experience across industries, we bring 
              proven HR strategies and practical solutions to the table.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div
            whileHover={isDesktop ? { scale: 1.05, y: -5 } : undefined}
            className="text-center group"
          >
            <motion.div
              whileHover={isDesktop ? { scale: 1.1 } : undefined}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 bg-secondary-50 border border-secondary-200 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg group-hover:border-secondary-300 transition-all duration-300"
            >
              <IconHeartHandshake className="w-8 h-8 text-secondary-500" stroke={1.7} />
            </motion.div>
            
            <h3 className="text-xl font-heading font-bold text-primary-900 mb-3">
              With You All the Way
            </h3>
            
            <p className="text-neutral-600 leading-relaxed">
              From your first hire to scaling your team, we provide ongoing 
              HR support, not just a one-time consultation.
            </p>
          </motion.div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.8 : 0, delay: isDesktop ? 0.6 : 0 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <Link href="/contact">
            <motion.button
              whileHover={isDesktop ? { scale: 1.05 } : undefined}
              whileTap={isDesktop ? { scale: 0.95 } : undefined}
              className="bg-primary-900 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-lg transition-all duration-300 flex items-center mx-auto"
            >
              Get Your HR Questions Answered
              <ArrowRight className="ml-2 w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default SlidingHRQuestions;
