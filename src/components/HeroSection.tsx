'use client';

import { motion, type Variants } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import SectionTitle from '@/components/SectionTitle';

const HeroSection = () => {
  const isDesktop = useIsDesktop();
  // Text animation variants — no stagger/delay on mobile for instant content
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: isDesktop
        ? { staggerChildren: 0.2, delayChildren: 0.3 }
        : { duration: 0 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: isDesktop ? 0.8 : 0, ease: 'easeOut' },
    },
  };

  const textVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: isDesktop ? 1 : 0, ease: 'easeOut' },
    },
  };

  // Client logos data
  const clients = [
    { name: "Central Bank of Kenya", logo: "/images/clients/cbk_loho.png" },
    { name: "Kenya Development Corporation", logo: "/images/clients/kdc_logo.png" },
    { name: "ICPAK", logo: "/images/clients/icpak_logo.png" },
    { name: "KeNIC", logo: "/images/clients/KeNIC_Logo.png" },
    { name: "KEBS", logo: "/images/clients/KEBS_Logo.png" },
    { name: "Consolidated Bank", logo: "/images/clients/consolidated_logo.webp" },
    { name: "Kenya Re", logo: "/images/clients/kenyare_logo.png" },
    { name: "TARDA", logo: "/images/clients/tarda_logo.png" },
    { name: "Pacida", logo: "/images/clients/Pacida Logo.png" },
    { name: "WSUP", logo: "/images/clients/WSUP_logo.png" },
    { name: "CMA", logo: "/images/clients/cma_logo.png" },
    { name: "Kimisitu", logo: "/images/clients/kimisitu_logo.png" },
  ];

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Background Image with Blur */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110 blur-sm"
          style={{
            backgroundImage: 'url(/images/hero/Reception_comp.webp)'
          }}
        />
        {/* White Overlay */}
        <div className="absolute inset-0 bg-white/50" />
      </div>

      {/* Main Hero Content */}
      <div className="container mx-auto px-4 relative z-10 flex-1 flex flex-col justify-center min-h-screen">
        <motion.div 
          variants={containerVariants}
          initial={isDesktop ? "hidden" : "visible"}
          animate="visible"
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div variants={textVariants} className="mb-8">
            <SectionTitle
              label="Leading HR in Kenya"
              title="Transforming your"
              titleLine2="human resources"
              subtitle="Building stronger organizations through tailored HR solutions and workforce transformation."
              variant="hero"
              className="text-primary-900"
            />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.div
              whileHover={isDesktop ? { scale: 1.05 } : undefined}
              whileTap={isDesktop ? { scale: 0.95 } : undefined}
            >
              <Link
                href="/contact"
                className="group bg-secondary-500 text-white px-8 py-4 rounded-lg font-medium text-lg hover:bg-secondary-600 hover:shadow-lg transform transition-all duration-300 flex items-center justify-center"
              >
                Partner With Us
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </motion.div>
            
            <motion.div
              whileHover={isDesktop ? { scale: 1.05 } : undefined}
              whileTap={isDesktop ? { scale: 0.95 } : undefined}
            >
              <Link
                href="/services"
                className="group border-2 border-primary-300 text-primary-800 px-8 py-4 rounded-lg font-medium text-lg hover:bg-primary-50 hover:border-primary-400 transition-all duration-300 flex items-center justify-center"
              >
                Explore Services
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Client Logos Ticker - Integrated into Hero */}
        <div className="absolute bottom-8 left-0 right-0">
          <motion.p 
            initial={isDesktop ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isDesktop ? 1.2 : 0, duration: isDesktop ? 0.6 : 0 }}
            className="text-center text-sm font-medium text-primary-600 mb-6"
          >
            Trusted by leading organizations across Kenya and beyond
          </motion.p>
          
          <motion.div
            initial={isDesktop ? { opacity: 0 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ delay: isDesktop ? 1.4 : 0, duration: isDesktop ? 0.8 : 0 }}
            className="relative overflow-hidden"
          >
            {/* Infinite scrolling ticker */}
            <div className="flex animate-scroll">
              {/* First set of logos */}
              {clients.map((client, index) => (
                <motion.div
                  key={`first-${index}`}
                  initial={{ opacity: 0, ...(isDesktop ? { scale: 0.8 } : {}) }}
                  animate={{ opacity: 1, ...(isDesktop ? { scale: 1 } : {}) }}
                  transition={{ delay: isDesktop ? 1.6 + index * 0.1 : 0, duration: isDesktop ? 0.5 : 0 }}
                  className="flex-shrink-0 mx-8 flex items-center justify-center h-[4.84rem]"
                >
                  <img 
                    src={client.logo} 
                    alt={client.name}
                    className={`${client.name === 'WSUP' ? 'h-[4.84rem] w-[12.1rem]' : client.name === 'KEBS' ? 'h-[4.84rem] w-auto' : client.name === 'Consolidated Bank' ? 'h-[4.84rem] w-auto' : client.name === 'Kenya Development Corporation' ? 'h-[4.84rem] w-auto' : client.name === 'TARDA' ? 'h-[4.235rem] w-auto' : client.name === 'Pacida' ? 'h-[2.42rem] w-auto' : client.name === 'CMA' ? 'h-[2.42rem] w-auto' : client.name === 'ICPAK' ? 'h-[2.42rem] w-auto' : 'h-[3.63rem] w-auto'} object-contain filter brightness-0 invert hover:brightness-100 hover:invert-0 transition-all duration-300 opacity-60 hover:opacity-100`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const sibling = e.currentTarget.nextElementSibling;
                      if (sibling instanceof HTMLElement) sibling.style.display = 'block';
                    }}
                  />
                  <span className="text-primary-600 font-medium text-xs hidden">{client.name}</span>
                </motion.div>
              ))}
              
              {/* Duplicate set for seamless loop */}
              {clients.map((client, index) => (
                <motion.div
                  key={`second-${index}`}
                  initial={{ opacity: 0, ...(isDesktop ? { scale: 0.8 } : {}) }}
                  animate={{ opacity: 1, ...(isDesktop ? { scale: 1 } : {}) }}
                  transition={{ delay: isDesktop ? 1.6 + index * 0.1 : 0, duration: isDesktop ? 0.5 : 0 }}
                  className="flex-shrink-0 mx-8 flex items-center justify-center h-[4.84rem]"
                >
                  <img 
                    src={client.logo} 
                    alt={client.name}
                    className={`${client.name === 'WSUP' ? 'h-[4.84rem] w-[12.1rem]' : client.name === 'KEBS' ? 'h-[4.84rem] w-auto' : client.name === 'Consolidated Bank' ? 'h-[4.84rem] w-auto' : client.name === 'Kenya Development Corporation' ? 'h-[4.84rem] w-auto' : client.name === 'TARDA' ? 'h-[4.235rem] w-auto' : client.name === 'Pacida' ? 'h-[2.42rem] w-auto' : client.name === 'CMA' ? 'h-[2.42rem] w-auto' : client.name === 'ICPAK' ? 'h-[2.42rem] w-auto' : 'h-[3.63rem] w-auto'} object-contain filter brightness-0 invert hover:brightness-100 hover:invert-0 transition-all duration-300 opacity-60 hover:opacity-100`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const sibling = e.currentTarget.nextElementSibling;
                      if (sibling instanceof HTMLElement) sibling.style.display = 'block';
                    }}
                  />
                  <span className="text-primary-600 font-medium text-xs hidden">{client.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>


      {/* Floating Elements — desktop only to avoid mobile jank */}
      {isDesktop && (
        <>
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 right-20 w-20 h-20 bg-secondary-500/20 rounded-full blur-xl"
          />
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-40 left-20 w-32 h-32 bg-primary-500/20 rounded-full blur-xl"
          />
        </>
      )}

    </section>
  );
};

export default HeroSection;