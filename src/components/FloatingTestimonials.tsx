'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Star, Quote, ArrowRight, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Testimonial } from '@/types';
import SectionTitle from '@/components/SectionTitle';
import Image from 'next/image';
import { useIsDesktop } from '@/hooks/useIsDesktop';

interface FloatingTestimonialsProps {
  testimonials: Testimonial[];
}

const FloatingTestimonials = ({ testimonials }: FloatingTestimonialsProps) => {
  const isDesktop = useIsDesktop();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const cardsPerView = isDesktop ? 3 : 1;
  const maxIndex = Math.max(0, testimonials.length - cardsPerView);

  useEffect(() => {
    if (currentIndex > maxIndex) setCurrentIndex(maxIndex);
  }, [currentIndex, maxIndex]);

  useEffect(() => {
    if (!isAutoPlaying || testimonials.length <= cardsPerView) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length, maxIndex, cardsPerView]);

  const goNext = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    setIsAutoPlaying(false);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    setIsAutoPlaying(false);
  };

  if (testimonials.length === 0) return null;

  const cardWidthPercent = 100 / cardsPerView;
  const trackWidthPercent = cardWidthPercent * testimonials.length;
  // translateX % is relative to track width; move by currentIndex cards
  const translatePercentOfTrack = testimonials.length > 0 ? (currentIndex * 100) / testimonials.length : 0;

  return (
    <section className="py-20 bg-gradient-to-br from-neutral-50 via-white to-primary-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ 
            rotate: 360,
            ...(isDesktop ? { scale: [1, 1.2, 1] } : {}),
            x: [0, 30, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-80 h-80 bg-secondary-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            rotate: -360,
            ...(isDesktop ? { scale: [1.1, 1, 1.1] } : {}),
            x: [0, -25, 0],
            y: [0, 15, 0]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-10 w-60 h-60 bg-primary-500/15 rounded-full blur-2xl"
        />
        <motion.div
          animate={{ 
            rotate: 180,
            ...(isDesktop ? { scale: [1, 1.3, 1] } : {}),
            x: [0, 40, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 left-20 w-40 h-40 bg-secondary-600/20 rounded-full blur-xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
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
              label="Testimonials"
              title="Trusted by industry leaders"
              titleLine2="across Kenya."
              subtitle="See how we've helped organisations transform their HR operations and achieve remarkable results."
              variant="section"
              className="mb-8"
            />
          </motion.div>
        </motion.div>

        {/* Carousel - 3 cards visible on desktop, 1 on mobile */}
        <div className="relative max-w-6xl mx-auto">
          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous testimonials"
            className="absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl border border-neutral-200 flex items-center justify-center text-primary-900 hover:text-secondary-500 transition-all duration-300 -left-4 md:-left-6"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next testimonials"
            className="absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl border border-neutral-200 flex items-center justify-center text-primary-900 hover:text-secondary-500 transition-all duration-300 -right-4 md:-right-6"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Sliding track */}
          <div className="overflow-hidden px-4 md:px-14">
            <motion.div
              className="flex"
              style={{ width: `${trackWidthPercent}%` }}
              animate={{ x: `-${translatePercentOfTrack}%` }}
              transition={{ type: 'tween', duration: 0.5, ease: 'easeInOut' }}
            >
              {testimonials.map((t) => (
                <div
                  key={t.id}
                  className="flex-shrink-0 px-2 box-border"
                  style={{ width: `${100 / testimonials.length}%` }}
                >
                  <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-lg h-full flex flex-col">
                    <Quote className="absolute top-6 left-6 w-8 h-8 text-secondary-500/30" />

                    <div className="relative z-10 flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden shadow-lg border-2 border-white bg-neutral-100 flex-shrink-0">
                          <Image
                            src={t.image || '/images/about/smile_1.jpg'}
                            alt={t.company}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base md:text-lg font-heading font-bold text-primary-900 truncate">
                            {t.name}
                          </h3>
                          <p className="text-secondary-500 font-medium text-xs md:text-sm">
                            {t.position}
                          </p>
                          <p className="text-neutral-600 text-xs md:text-sm font-medium truncate">
                            {t.company}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 md:w-5 md:h-5 ${
                              i < t.rating ? 'text-secondary-500 fill-current' : 'text-neutral-300'
                            }`}
                          />
                        ))}
                      </div>

                      <blockquote className="text-neutral-700 text-sm md:text-base leading-relaxed italic line-clamp-5">
                        &ldquo;{t.content}&rdquo;
                      </blockquote>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Dots - one per card, active = first visible index */}
          <div className="flex justify-center gap-2 mt-8 flex-wrap">
            {testimonials.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const next = Math.min(index, maxIndex);
                  setCurrentIndex(next);
                  setIsAutoPlaying(false);
                }}
                aria-label={`Go to slide ${index + 1}`}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index >= currentIndex && index < currentIndex + cardsPerView
                    ? 'bg-primary-900 w-8'
                    : 'bg-neutral-300 hover:bg-neutral-400'
                }`}
              />
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: isDesktop ? 0.8 : 0, delay: isDesktop ? 0.4 : 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <div className="bg-white border-2 border-neutral-200 rounded-2xl p-8 md:p-12 relative overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500">
              <div className="relative z-10">
                <h3 className="text-2xl md:text-3xl font-heading font-bold text-primary-900 mb-4">
                  Ready to Join Our Success Stories?
                </h3>
                <p className="text-lg text-neutral-700 mb-8 max-w-2xl mx-auto">
                  Let us help you achieve the same level of HR excellence that our clients have experienced.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button
                    whileHover={isDesktop ? { scale: 1.05, y: -2 } : undefined}
                    whileTap={isDesktop ? { scale: 0.95 } : undefined}
                    className="bg-primary-900 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-800 hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                  >
                    Start Your Success Story
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </motion.button>
                  
                  <motion.button
                    whileHover={isDesktop ? { scale: 1.05, y: -2 } : undefined}
                    whileTap={isDesktop ? { scale: 0.95 } : undefined}
                    className="border-2 border-primary-900 text-primary-900 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-900 hover:text-white transition-all duration-300 flex items-center justify-center"
                  >
                    View All Case Studies
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FloatingTestimonials;
