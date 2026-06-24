'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { Testimonial } from '@/types';

interface TestimonialSliderProps {
  testimonials: Testimonial[];
}

const TestimonialSlider = ({ testimonials }: TestimonialSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const controls = useAnimation();

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  // Animation for slide transitions
  useEffect(() => {
    controls.start({
      x: -currentIndex * 100,
      transition: { duration: 0.6, ease: "easeInOut" }
    });
  }, [currentIndex, controls]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

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
          className="absolute top-20 right-20 w-32 h-32 bg-secondary-200/20 rounded-full blur-xl"
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
          className="absolute bottom-20 left-20 w-40 h-40 bg-primary-200/20 rounded-full blur-xl"
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
            Client Testimonials
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-primary-900 mb-6">
            What Our Clients Say
            <span className="block text-secondary-500 mt-2">About Our Services</span>
          </h2>
          
          <p className="text-xl text-neutral-700 max-w-3xl mx-auto leading-relaxed">
            Don't just take our word for it. Here's what our clients have to say about 
            their experience working with Stride.
          </p>
        </motion.div>

        {/* Slider Container */}
        <div className="relative max-w-6xl mx-auto">
          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
            onMouseEnter={() => setIsAutoPlaying(false)}
          >
            <ChevronLeft className="w-6 h-6 text-primary-900 group-hover:text-secondary-500 transition-colors duration-200" />
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
            onMouseEnter={() => setIsAutoPlaying(false)}
          >
            <ChevronRight className="w-6 h-6 text-primary-900 group-hover:text-secondary-500 transition-colors duration-200" />
          </button>

          {/* Slider */}
          <div className="overflow-hidden rounded-2xl">
            <motion.div
              animate={controls}
              className="flex"
              style={{ width: `${testimonials.length * 100}%` }}
            >
              {testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.id}
                  className="w-full flex-shrink-0"
                  style={{ width: `${100 / testimonials.length}%` }}
                >
                  <div className="bg-white border-2 border-neutral-200 rounded-2xl p-8 md:p-12 mx-4 shadow-lg hover:shadow-xl transition-all duration-500">
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      {/* Left Side - Client Info */}
                      <div className="text-center md:text-left">
                        <div className="relative mb-6">
                          <Quote className="w-16 h-16 text-secondary-500/20 absolute -top-4 -left-4" />
                          <div className="relative z-10">
                            <div className="w-20 h-20 bg-gradient-to-br from-primary-900 to-secondary-500 rounded-full mx-auto md:mx-0 mb-4 flex items-center justify-center text-white text-2xl font-bold">
                              {testimonial.name.charAt(0)}
                            </div>
                            <h3 className="text-xl font-heading font-bold text-primary-900 mb-2">
                              {testimonial.name}
                            </h3>
                            <p className="text-secondary-500 font-medium mb-4">
                              {testimonial.position}
                            </p>
                            <p className="text-neutral-600 text-sm">
                              {testimonial.company}
                            </p>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="flex justify-center md:justify-start space-x-1 mb-4">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${
                                i < testimonial.rating
                                  ? 'text-secondary-500 fill-current'
                                  : 'text-neutral-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Right Side - Testimonial Content */}
                      <div className="relative">
                        <Quote className="w-12 h-12 text-secondary-500/30 absolute -top-2 -left-2" />
                        <blockquote className="text-lg text-neutral-700 leading-relaxed relative z-10 italic">
                          "{testimonial.content}"
                        </blockquote>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center space-x-3 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-primary-900 scale-125'
                    : 'bg-neutral-300 hover:bg-neutral-400'
                }`}
                onMouseEnter={() => setIsAutoPlaying(false)}
              />
            ))}
          </div>

          {/* Auto-play Toggle */}
          <div className="text-center mt-6">
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="text-sm text-neutral-600 hover:text-primary-900 transition-colors duration-200"
            >
              {isAutoPlaying ? 'Pause' : 'Play'} Auto-slide
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialSlider;
