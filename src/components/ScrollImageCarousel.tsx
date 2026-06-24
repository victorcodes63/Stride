'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';

interface ScrollImageCarouselProps {
  images: string[];
  alt: string;
}

const ScrollImageCarousel = ({ images, alt }: ScrollImageCarouselProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Calculate which image should be shown based on scroll progress
  useEffect(() => {
    const unsubscribe = scrollYProgress.onChange((latest) => {
      const imageIndex = Math.min(
        Math.floor(latest * images.length),
        images.length - 1
      );
      setCurrentImageIndex(imageIndex);
    });

    return unsubscribe;
  }, [scrollYProgress, images.length]);

  return (
    <div ref={containerRef} className="relative h-[600px] w-full overflow-hidden rounded-2xl">
      {/* Background Images */}
      {images.map((image, index) => (
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: currentImageIndex === index ? 1 : 0,
            scale: currentImageIndex === index ? 1 : 1.1
          }}
          transition={{ 
            duration: 0.8, 
            ease: "easeInOut" 
          }}
        >
          <Image
            src={image}
            alt={`${alt} ${index + 1}`}
            fill
            className="object-cover"
            priority={index === 0}
          />
          
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </motion.div>
      ))}

      {/* Image Counter */}
      <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium text-primary-900">
        {currentImageIndex + 1} / {images.length}
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm rounded-full p-3"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-6 border-2 border-primary-900 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-primary-900 rounded-full animate-pulse" />
        </div>
      </motion.div>
    </div>
  );
};

export default ScrollImageCarousel;
