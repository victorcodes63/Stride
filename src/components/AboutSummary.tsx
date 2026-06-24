'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Target, Eye, Heart, Users, CheckCircle, ArrowRight } from 'lucide-react';
import ScrollImageCarousel from './ScrollImageCarousel';

const AboutSummary = () => {
  // Images for scroll carousel
  const aboutImages = [
    '/images/hero/Reception_comp.webp', // Main hero image
    '/images/team/team-meeting.jpg', // Team collaboration
    '/images/team/office-space.jpg', // Modern office
    '/images/team/consultation.jpg', // Client consultation
    '/images/team/training-session.jpg', // Training session
    '/images/team/success-celebration.jpg' // Success celebration
  ];

  const values = [
    {
      icon: Target,
      title: 'Mission',
      description: 'To deliver exceptional HR solutions that empower organizations to achieve their full potential through their greatest asset - their people.'
    },
    {
      icon: Eye,
      title: 'Vision',
      description: 'To be the leading HR consulting firm in East Africa, recognized for excellence, innovation, and transformative impact.'
    },
    {
      icon: Heart,
      title: 'Values',
      description: 'Integrity, excellence, innovation, and client-centricity guide everything we do in our commitment to HR excellence.'
    }
  ];

  const achievements = [
    '7+ Years of HR Excellence',
    '500+ Companies Served',
    '2000+ Successful Placements',
    '98% Client Satisfaction Rate'
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content - Scroll Image Carousel */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <ScrollImageCarousel 
              images={aboutImages} 
              alt="Stride team and office" 
            />
          </motion.div>

          {/* Right Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-900 rounded-full text-sm font-medium mb-4">
                  <Users className="w-4 h-4 mr-2 text-secondary-500" />
                  About Stride
                </div>
                
                <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-900 mb-6">
                  Transforming Organizations Through
                  <span className="block text-primary-900 mt-2">Human Excellence</span>
                </h2>
                
                <p className="text-lg text-neutral-700 leading-relaxed mb-8">
                  Since our inception in 2017, Stride has been at the forefront of 
                  human resource innovation in Kenya. We combine deep local expertise with 
                  global best practices to deliver solutions that drive measurable results.
                </p>
              </motion.div>

              {/* Achievement Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                viewport={{ once: true }}
                className="grid grid-cols-2 gap-4 mb-8"
              >
                {achievements.map((achievement, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                    viewport={{ once: true }}
                    className="flex items-center space-x-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors duration-200"
                  >
                    <CheckCircle className="w-5 h-5 text-secondary-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-neutral-700">{achievement}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* Mission, Vision, Values */}
              <div className="space-y-6 mb-8">
                {values.map((value, index) => (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.2, duration: 0.6 }}
                    viewport={{ once: true }}
                    className="group bg-gradient-to-br from-neutral-50 to-white p-6 rounded-xl border border-neutral-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-start space-x-4">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="w-12 h-12 bg-secondary-50 rounded-lg flex items-center justify-center border border-secondary-100 group-hover:shadow-md transition-all duration-300"
                      >
                        <value.icon className="w-6 h-6 text-secondary-500" />
                      </motion.div>
                      
                      <div className="flex-1">
                        <h3 className="text-xl font-heading font-semibold text-primary-900 mb-2">
                          {value.title}
                        </h3>
                        <p className="text-neutral-600 leading-relaxed">
                          {value.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Link
                  href="/about"
                  className="inline-flex items-center px-6 py-3 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Learn More About Us
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSummary;