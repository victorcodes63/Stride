'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { 
  Award, 
  Users, 
  Building, 
  TrendingUp, 
  CheckCircle, 
  Star,
  Target,
  Shield,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useIsDesktop } from '@/hooks/useIsDesktop';

type StatItem = {
  icon: typeof Clock;
  value: number;
  suffix: string;
  label: string;
  description: string;
};

function StatCounterCard({
  stat,
  index,
  isInView,
  isDesktop,
}: {
  stat: StatItem;
  index: number;
  isInView: boolean;
  isDesktop: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime = 0;
    const duration = 2000;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * stat.value));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, stat.value]);

  const Icon = stat.icon;

  return (
    <motion.div
      key={stat.label}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="text-center group"
    >
      <motion.div
        whileHover={isDesktop ? { scale: 1.1 } : undefined}
        className="w-20 h-20 bg-secondary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-secondary-100 shadow-lg group-hover:shadow-xl transition-all duration-300"
      >
        <Icon className="w-8 h-8 text-secondary-500" />
      </motion.div>

      <motion.div
        initial={isDesktop ? { scale: 0.8 } : {}}
        whileInView={isDesktop ? { scale: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
        viewport={{ once: true }}
        className="text-4xl md:text-5xl font-bold text-primary-900 mb-2"
      >
        {count}
        {stat.suffix}
      </motion.div>

      <h3 className="text-lg font-semibold text-primary-900 mb-2">{stat.label}</h3>

      <p className="text-sm text-neutral-600">{stat.description}</p>
    </motion.div>
  );
}

const ValueProposition = () => {
  const isDesktop = useIsDesktop();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  // Statistics data
  const stats = [
    {
      icon: Clock,
      value: 7,
      suffix: '+',
      label: 'Years of Excellence',
      description: 'Delivering HR solutions since 2017'
    },
    {
      icon: Building,
      value: 500,
      suffix: '+',
      label: 'Companies Served',
      description: 'Across diverse industries'
    },
    {
      icon: Users,
      value: 2000,
      suffix: '+',
      label: 'Successful Placements',
      description: 'Right talent, right fit'
    },
    {
      icon: Star,
      value: 98,
      suffix: '%',
      label: 'Client Satisfaction',
      description: 'Consistently exceeding expectations'
    }
  ];

  // Company milestones
  const milestones = [
    {
      year: '2017',
      title: 'Company Founded',
      description: 'Stride established with a vision to transform HR in Kenya',
      icon: Target
    },
    {
      year: '2018',
      title: 'First Major Client',
      description: 'Secured partnership with leading financial institution',
      icon: Building
    },
    {
      year: '2020',
      title: 'Digital Transformation',
      description: 'Launched innovative HR technology solutions and remote services',
      icon: Shield
    },
    {
      year: '2021',
      title: 'Regional Expansion',
      description: 'Extended services across East Africa region',
      icon: TrendingUp
    },
    {
      year: '2023',
      title: 'Industry Recognition',
      description: 'Awarded Best HR Consultancy in Kenya',
      icon: Award
    },
    {
      year: '2024',
      title: 'Future Ready',
      description: 'Leading HR innovation with AI and analytics',
      icon: Star
    }
  ];

  // Trust indicators
  const trustBadges = [
    { name: 'IHRM Certified', icon: Award, color: 'text-blue-600' },
    { name: 'ISO 9001:2015', icon: Shield, color: 'text-green-600' },
    { name: 'KIPPRA Partner', icon: Building, color: 'text-purple-600' },
    { name: 'CIPD Accredited', icon: Star, color: 'text-orange-600' }
  ];

  // Success metrics
  const successMetrics = [
    {
      metric: '40%',
      label: 'Reduced Turnover',
      description: 'Average reduction in employee turnover for our clients'
    },
    {
      metric: '60%',
      label: 'Faster Hiring',
      description: 'Reduction in time-to-hire for key positions'
    },
    {
      metric: '85%',
      label: 'Retention Rate',
      description: 'Average employee retention rate improvement'
    },
    {
      metric: '3x',
      label: 'ROI Increase',
      description: 'Return on investment for HR initiatives'
    }
  ];

  const [activeMilestone, setActiveMilestone] = useState(0);

  return (
    <section ref={ref} className="py-20 bg-gradient-to-br from-primary-50 via-white to-secondary-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ 
            rotate: 360,
            ...(isDesktop ? { scale: [1, 1.1, 1] } : {}),
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-20 right-20 w-32 h-32 bg-primary-200/30 rounded-full blur-xl"
        />
        <motion.div
          animate={{ 
            rotate: -360,
            ...(isDesktop ? { scale: [1.1, 1, 1.1] } : {}),
          }}
          transition={{ 
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-20 left-20 w-40 h-40 bg-secondary-200/30 rounded-full blur-xl"
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
            initial={{ opacity: 0, ...(isDesktop ? { scale: 0.8 } : {}) }}
            whileInView={{ opacity: 1, ...(isDesktop ? { scale: 1 } : {}) }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary-900 to-secondary-500 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
          >
            <Award className="w-4 h-4 mr-2" />
            Why 500+ Companies Choose Stride
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-primary-900 mb-6">
            Proven Excellence in
            <span className="block text-secondary-500 mt-2">Human Resources</span>
          </h2>
          
          <p className="text-xl text-neutral-700 max-w-3xl mx-auto leading-relaxed">
            For over 7 years, we've been the trusted partner for organizations seeking 
            to transform their human resources and achieve sustainable growth.
          </p>
        </motion.div>

        {/* Animated Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-20"
        >
          {stats.map((stat, index) => (
            <StatCounterCard
              key={stat.label}
              stat={stat}
              index={index}
              isInView={isInView}
              isDesktop={isDesktop}
            />
          ))}
        </motion.div>

        {/* Interactive Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-heading font-bold text-primary-900 mb-4">
              Our Journey of Excellence
            </h3>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              From humble beginnings to industry leadership, discover the milestones 
              that shaped our commitment to HR excellence.
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-primary-900 via-secondary-500 to-primary-900 rounded-full"></div>
            
            <div className="space-y-12">
              {milestones.map((milestone, index) => {
                const Icon = milestone.icon;
                const isActive = activeMilestone === index;
                
                return (
                  <motion.div
                    key={milestone.year}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}
                    onMouseEnter={() => setActiveMilestone(index)}
                  >
                    {/* Timeline Node */}
                    <motion.div
                      whileHover={isDesktop ? { scale: 1.2 } : undefined}
                      className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-br from-secondary-500 to-primary-900 lg:scale-110' 
                          : 'bg-white border-4 border-primary-900'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-primary-900'}`} />
                    </motion.div>
                    
                    {/* Content Card */}
                    <motion.div
                      whileHover={isDesktop ? { scale: 1.02, y: -5 } : undefined}
                      className={`w-5/12 mx-8 p-6 rounded-xl shadow-lg transition-all duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-br from-primary-900 to-secondary-500 text-white' 
                          : 'bg-white hover:shadow-xl'
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <span className={`text-2xl font-bold ${isActive ? 'text-white' : 'text-primary-900'}`}>
                          {milestone.year}
                        </span>
                        <motion.div
                          animate={isDesktop && isActive ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 0.5 }}
                          className={`ml-3 w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-secondary-500'}`}
                        />
                      </div>
                      
                      <h4 className={`text-xl font-semibold mb-2 ${isActive ? 'text-white' : 'text-primary-900'}`}>
                        {milestone.title}
                      </h4>
                      
                      <p className={`text-sm leading-relaxed ${isActive ? 'text-white/90' : 'text-neutral-600'}`}>
                        {milestone.description}
                      </p>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-heading font-bold text-primary-900 mb-4">
              Trusted & Certified
            </h3>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Our certifications and partnerships demonstrate our commitment to 
              excellence and industry best practices.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {trustBadges.map((badge, index) => {
              const Icon = badge.icon;
              
              return (
                <motion.div
                  key={badge.name}
                  initial={{ opacity: 0, ...(isDesktop ? { scale: 0.8 } : {}) }}
                  whileInView={{ opacity: 1, ...(isDesktop ? { scale: 1 } : {}) }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={isDesktop ? { scale: 1.05, y: -5 } : undefined}
                  className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-center group"
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="w-16 h-16 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:shadow-lg transition-all duration-300"
                  >
                    <Icon className={`w-8 h-8 ${badge.color}`} />
                  </motion.div>
                  
                  <h4 className="font-semibold text-primary-900 text-sm">
                    {badge.name}
                  </h4>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Success Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-primary-900 to-secondary-500 rounded-2xl p-8 md:p-12 text-white"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-heading font-bold mb-4">
              Measurable Results for Our Clients
            </h3>
            <p className="text-lg text-white/90 max-w-3xl mx-auto">
              Our data-driven approach delivers tangible improvements that 
              directly impact your organization's bottom line.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {successMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <motion.div
                  whileHover={isDesktop ? { scale: 1.1 } : undefined}
                  className="text-4xl md:text-5xl font-bold mb-3 group-hover:text-secondary-300 transition-colors duration-300"
                >
                  {metric.metric}
                </motion.div>
                
                <h4 className="text-lg font-semibold mb-2">
                  {metric.label}
                </h4>
                
                <p className="text-sm text-white/80 leading-relaxed">
                  {metric.description}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <motion.button
              whileHover={isDesktop ? { scale: 1.05 } : undefined}
              whileTap={isDesktop ? { scale: 0.95 } : undefined}
              className="bg-white text-primary-900 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-neutral-100 hover:shadow-lg transition-all duration-300 flex items-center mx-auto"
            >
              Discover Your Success Story
              <ArrowRight className="ml-2 w-5 h-5" />
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default ValueProposition;
