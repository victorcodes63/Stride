'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle, ArrowRight } from 'lucide-react'

interface FounderSectionProps {
  founder: {
    name: string
    title: string
    image: string
    bio: string[]
    achievements: {
      title: string
      description: string
    }[]
    philosophy: {
      title: string
      description: string
    }[]
    linkedin?: string
    ctaText?: string
    ctaLink?: string
  }
}

const FounderSection = ({ founder }: FounderSectionProps) => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-900 mb-4">
            Meet Our Chairman
          </h2>
          <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
            The vision and leadership behind Stride
          </p>
        </motion.div>

        {/* Founder Profile */}
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-12 items-start">
            {/* Image Section - Symmetrical Layout */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="lg:col-span-1 space-y-4"
            >
              {/* Main Portrait */}
              <div className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src={founder.image}
                  alt={founder.name}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>

                    {/* Overlay Text */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <h3 className="text-2xl font-heading font-bold mb-1 text-white">
                        {founder.name}
                      </h3>
                      <p className="text-lg text-white font-semibold">
                        {founder.title}
                      </p>
                    </div>
              </div>

              {/* Two Additional Images - Stacked Vertically */}
              <div className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      viewport={{ once: true }}
                      className="relative h-[191px] lg:h-[223px] rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                    >
                      <Image
                        src="/images/team/chair_reading.jpeg"
                    alt="Dr. Ben Chumo - Reading and Research"
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs text-white/90 font-medium">Reading & Research</p>
                  </div>
                </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      viewport={{ once: true }}
                      className="relative h-[191px] lg:h-[223px] rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                    >
                      <Image
                        src="/images/team/chair_speaking.jpeg"
                    alt="Dr. Ben Chumo - Speaking Engagement"
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs text-white/90 font-medium">Speaking Engagement</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Content Section */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="lg:col-span-2 space-y-8"
            >
              {/* Bio */}
              <div className="space-y-4 text-neutral-700 text-lg leading-relaxed">
                {founder.bio.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}

                <blockquote className="bg-primary-50 border-l-4 border-secondary-500 p-6 rounded-r-xl italic text-primary-900">
                  "Our mission is simple: to help organizations unlock their full potential through their people."
                </blockquote>
              </div>

              {/* Achievements */}
              <div className="bg-gradient-to-br from-neutral-50 to-white rounded-2xl p-8 border border-neutral-200">
                <h4 className="text-2xl font-heading font-bold text-primary-900 mb-6">
                  Achievements & Recognition
                </h4>
                <div className="grid md:grid-cols-2 gap-6">
                  {[0, 1].map(col => (
                    <div key={col} className="space-y-4">
                      {founder.achievements
                        .slice(col * 2, col * 2 + 2)
                        .map((achievement, index) => (
                          <div
                            key={index}
                            className="flex items-start space-x-3"
                          >
                            <CheckCircle className="w-5 h-5 text-secondary-500 mt-1 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-primary-900">
                                {achievement.title}
                              </p>
                              <p className="text-sm text-neutral-600">
                                {achievement.description}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                {founder.linkedin && (
                  <Link
                    href={founder.linkedin}
                    className="inline-flex items-center px-8 py-4 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 transition-colors duration-300"
                  >
                    Connect on LinkedIn
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                )}
                <Link
                  href={founder.ctaLink || '/contact'}
                  className="inline-flex items-center px-8 py-4 border-2 border-primary-900 text-primary-900 rounded-lg font-semibold hover:bg-primary-900 hover:text-white transition-all duration-300"
                >
                  {founder.ctaText || 'Schedule a Meeting'}
                </Link>
              </div>

            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FounderSection
