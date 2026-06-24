'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import ServiceCard from './ServiceCard';
import { Service } from '@/types';
import { ArrowRight } from 'lucide-react';

const ServicesPreview = () => {
  const services: Service[] = [
    {
      id: '1',
      title: 'Recruitment & Executive Search',
      description: 'Find the right talent for your organization with our comprehensive recruitment solutions.',
      icon: 'users',
      features: [
        'Executive Search',
        'Technical Recruitment',
        'Talent Assessment',
        'Interview Coordination'
      ]
    },
    {
      id: '2',
      title: 'HR Outsourcing',
      description: 'Streamline your HR operations with our professional outsourcing services.',
      icon: 'building',
      features: [
        'Payroll Management',
        'HR Administration',
        'Policy Development',
        'Compliance Management'
      ]
    },
    {
      id: '3',
      title: 'Training & Development',
      description: 'Enhance your team\'s capabilities with our customized training programs.',
      icon: 'graduation',
      features: [
        'Leadership Development',
        'Skills Training',
        'Team Building',
        'Performance Management'
      ]
    },
    {
      id: '4',
      title: 'HR Compliance & Legal',
      description: 'Ensure your organization meets all Kenyan labor laws and regulations.',
      icon: 'shield',
      features: [
        'Labor Law Compliance',
        'Employment Contracts',
        'Disciplinary Procedures',
        'Legal Advisory'
      ]
    },
    {
      id: '5',
      title: 'Performance Management',
      description: 'Optimize employee performance with our structured management systems.',
      icon: 'target',
      features: [
        'Performance Reviews',
        'Goal Setting',
        'KPI Development',
        'Performance Improvement'
      ]
    },
    {
      id: '6',
      title: 'Employee Relations',
      description: 'Build positive workplace relationships and resolve conflicts effectively.',
      icon: 'heart',
      features: [
        'Conflict Resolution',
        'Employee Engagement',
        'Workplace Mediation',
        'Culture Development'
      ]
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-neutral-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-4 py-2 bg-secondary-100 text-secondary-800 rounded-full text-sm font-medium mb-4">
            Our Services
          </div>
          
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-900 mb-6">
            Comprehensive HR Solutions
            <span className="block text-primary-900 mt-2">Tailored to Your Needs</span>
          </h2>
          
          <p className="text-lg text-neutral-700 max-w-3xl mx-auto leading-relaxed">
            We offer a full spectrum of HR services designed to help your organization 
            thrive in today's competitive business environment.
          </p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {services.map((service, index) => (
            <ServiceCard key={service.id} service={service} index={index} />
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="bg-gradient-to-r from-primary-900 to-primary-800 rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4">
              Ready to Transform Your HR?
            </h3>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Discover how our comprehensive HR services can drive your organization's success. 
              Let's discuss your specific needs and create a tailored solution.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/services"
                className="group bg-white text-primary-900 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-neutral-100 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center"
              >
                View All Services
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              
              <Link
                href="/contact"
                className="group border-2 border-white/30 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 hover:border-white/50 backdrop-blur-sm transition-all duration-300 flex items-center justify-center"
              >
                Get Started Today
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ServicesPreview;

