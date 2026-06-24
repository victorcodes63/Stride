'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Users, 
  Building, 
  GraduationCap, 
  Shield, 
  Target, 
  Heart,
  ArrowRight,
  CheckCircle,
  Star
} from 'lucide-react';

const CreativeServicesSection = () => {
  const services = [
    {
      id: '1',
      title: 'Recruitment & Executive Search',
      description: 'Find the right talent for your organization with our comprehensive recruitment solutions.',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'from-blue-50 to-blue-100',
      features: ['Executive Search', 'Technical Recruitment', 'Talent Assessment', 'Interview Coordination'],
      link: '/services/recruitment'
    },
    {
      id: '2',
      title: 'HR Outsourcing',
      description: 'Streamline your HR operations with our professional outsourcing services.',
      icon: Building,
      color: 'from-green-500 to-green-600',
      bgColor: 'from-green-50 to-green-100',
      features: ['Payroll Management', 'HR Administration', 'Policy Development', 'Compliance Management'],
      link: '/services/hr-outsourcing'
    },
    {
      id: '3',
      title: 'Training & Development',
      description: 'Enhance your team\'s capabilities with our customized training programs.',
      icon: GraduationCap,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'from-purple-50 to-purple-100',
      features: ['Leadership Development', 'Skills Training', 'Team Building', 'Performance Management'],
      link: '/services/training-development'
    },
    {
      id: '4',
      title: 'HR Compliance & Legal',
      description: 'Ensure your organization meets all Kenyan labor laws and regulations.',
      icon: Shield,
      color: 'from-red-500 to-red-600',
      bgColor: 'from-red-50 to-red-100',
      features: ['Labor Law Compliance', 'Employment Contracts', 'Disciplinary Procedures', 'Legal Advisory'],
      link: '/services/hr-compliance'
    },
    {
      id: '5',
      title: 'Performance Management',
      description: 'Optimize employee performance with our structured management systems.',
      icon: Target,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'from-orange-50 to-orange-100',
      features: ['Performance Reviews', 'Goal Setting', 'KPI Development', 'Performance Improvement'],
      link: '/services/performance-management'
    },
    {
      id: '6',
      title: 'Employee Relations',
      description: 'Build positive workplace relationships and resolve conflicts effectively.',
      icon: Heart,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'from-pink-50 to-pink-100',
      features: ['Conflict Resolution', 'Employee Engagement', 'Workplace Mediation', 'Culture Development'],
      link: '/services/employee-relations'
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-neutral-50 via-white to-primary-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-20 right-20 w-32 h-32 bg-primary-200/20 rounded-full blur-xl"
        />
        <motion.div
          animate={{ 
            rotate: -360,
            scale: [1.1, 1, 1.1]
          }}
          transition={{ 
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-20 left-20 w-40 h-40 bg-secondary-200/20 rounded-full blur-xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="inline-flex items-center px-6 py-3 bg-primary-900 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
          >
            <Star className="w-4 h-4 mr-2" />
            Our Services
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-primary-900 mb-6">
            Comprehensive HR Solutions
            <span className="block text-secondary-500 mt-2">Tailored to Your Needs</span>
          </h2>
          
          <p className="text-xl text-neutral-700 max-w-3xl mx-auto leading-relaxed">
            We offer a full spectrum of HR services designed to help your organization 
            thrive in today's competitive business environment.
          </p>
        </motion.div>

        {/* Creative Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative"
              >
                {/* Service Card */}
                <div className={`relative bg-gradient-to-br ${service.bgColor} rounded-2xl p-8 h-full border border-white/20 shadow-lg group-hover:shadow-2xl transition-all duration-500 overflow-hidden`}>
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-4 right-4 w-20 h-20 border-2 border-current rounded-full"></div>
                    <div className="absolute bottom-4 left-4 w-16 h-16 border-2 border-current rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-current rounded-full"></div>
                  </div>

                  {/* Icon — same styling site-wide: cream bg + gold icon */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    className="w-16 h-16 bg-secondary-50 rounded-2xl flex items-center justify-center mb-6 border border-secondary-100 shadow-md group-hover:shadow-lg transition-all duration-300"
                  >
                    <Icon className="w-8 h-8 text-secondary-500" />
                  </motion.div>

                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="text-xl font-heading font-bold text-primary-900 mb-4 group-hover:text-secondary-500 transition-colors duration-300">
                      {service.title}
                    </h3>
                    
                    <p className="text-neutral-700 mb-6 leading-relaxed">
                      {service.description}
                    </p>

                    {/* Features */}
                    <div className="space-y-2 mb-6">
                      {service.features.map((feature, featureIndex) => (
                        <motion.div
                          key={featureIndex}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.2 + featureIndex * 0.1 }}
                          viewport={{ once: true }}
                          className="flex items-center space-x-2"
                        >
                          <CheckCircle className="w-4 h-4 text-secondary-500 flex-shrink-0" />
                          <span className="text-sm text-neutral-600">{feature}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* CTA Link */}
                    <Link
                      href={service.link}
                      className={`inline-flex items-center px-4 py-2 bg-gradient-to-r ${service.color} text-white rounded-lg font-medium hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 text-sm`}
                    >
                      Learn More
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </div>

                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="bg-gradient-to-r from-primary-900 to-secondary-500 rounded-2xl p-8 md:p-12 text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-8 right-8 w-32 h-32 border-2 border-white rounded-full"></div>
              <div className="absolute bottom-8 left-8 w-24 h-24 border-2 border-white rounded-full"></div>
            </div>

            <div className="relative z-10">
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
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CreativeServicesSection;
