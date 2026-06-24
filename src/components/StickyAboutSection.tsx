'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import SectionTitle from '@/components/SectionTitle';

const StickyAboutSection = () => {
  const aboutImages = [
    '/images/about/main_1.jpeg',
    '/images/about/pic_1.jpeg',
    '/images/about/pic_3.jpeg',
    '/images/about/pic_4.jpeg',
    '/images/about/C1DA58D7-86D6-4B35-B90C-C3C981540240_1_201_a.jpeg',
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % aboutImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + aboutImages.length) % aboutImages.length);
  };

  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-b from-white via-neutral-50 to-white overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-secondary-500/30 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -14, 0], y: [0, 10, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-[-3rem] bottom-8 h-52 w-52 rounded-full bg-primary-300/30 blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-8 md:mb-10"
        >
          <SectionTitle
            label="About us"
            title="Your partner"
            titleLine2="in HR excellence."
            variant="section"
          />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Image carousel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative h-[300px] sm:h-[350px] md:h-[400px] lg:h-[450px] w-full overflow-hidden rounded-xl">
              <motion.div
                key={currentImageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0"
              >
                <Image
                  src={aboutImages[currentImageIndex]}
                  alt={`Stride ${currentImageIndex + 1}`}
                  fill
                  className="object-cover"
                  priority={currentImageIndex === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
              </motion.div>

              <button
                type="button"
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-200"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 text-primary-900" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-200"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 text-primary-900" />
              </button>

              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-primary-900">
                {currentImageIndex + 1} / {aboutImages.length}
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {aboutImages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Text + CTA */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2 space-y-6"
          >
            <div className="space-y-4">
              <p className="text-base md:text-lg text-neutral-700 leading-relaxed">
                Founded in 2017, Stride emerged as a response to the growing need for professional HR services in Kenya&apos;s rapidly expanding business landscape.
              </p>
              <p className="text-base md:text-lg text-neutral-700 leading-relaxed">
                Starting with a small team of HR experts, we quickly established ourselves as trusted partners for organizations seeking to optimize their human capital.
              </p>
              <p className="text-base md:text-lg text-neutral-700 leading-relaxed">
                Today, we serve over 100 companies across diverse industries, combining deep local market knowledge with international best practices to deliver transformative HR solutions.
              </p>
            </div>
            <Link
              href="/about"
              className="inline-flex items-center px-6 py-3 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Learn More About Us
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default StickyAboutSection;
