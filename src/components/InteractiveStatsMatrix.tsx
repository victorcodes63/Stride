'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const InteractiveStatsMatrix = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const stats = [
    {
      number: "7+",
      label: "Years of Excellence",
      description: "Delivering HR solutions since 2017",
      background: "/images/clients/meeting_team.jpeg"
    },
    {
      number: "100+",
      label: "Companies Served",
      description: "Across diverse industries",
      background: "/images/clients/meeting_2.jpeg"
    },
    {
      number: "2000+",
      label: "Successful Placements",
      description: "Right talent, right fit",
      background: "/images/clients/meeting_team.jpeg"
    },
    {
      number: "98%",
      label: "Client Satisfaction",
      description: "Proven track record",
      background: "/images/clients/meeting_2.jpeg"
    }
  ]

  // Handle hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Auto-rotate slowly for a calmer carousel feel
  useEffect(() => {
    if (!isHovered && isMounted) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % stats.length)
      }, 4200)
      return () => clearInterval(interval)
    }
  }, [isHovered, stats.length, isMounted])

  const handleDotClick = (index: number) => {
    setCurrentIndex(index)
  }

  const currentStat = stats[currentIndex]

  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return (
      <div className="relative">
        <div className="relative h-56 md:h-72 flex items-center justify-center overflow-hidden rounded-xl bg-primary-50 border border-primary-100">
          <img
            src={stats[0].background}
            alt={stats[0].label}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="text-center relative z-10">
            <div className="text-5xl md:text-6xl font-bold text-primary-900 mb-3">
              {stats[0].number}
            </div>
            <div className="text-lg md:text-xl font-semibold text-primary-900 mb-1">
              {stats[0].label}
            </div>
            <div className="text-xs md:text-sm text-primary-700">
              {stats[0].description}
            </div>
          </div>
        </div>
        <div className="flex justify-center space-x-3 mt-6">
          {stats.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full ${
                index === 0 ? 'bg-primary-600 scale-125' : 'bg-primary-200'
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Display Area */}
      <div className="relative h-56 md:h-72 flex items-center justify-center overflow-hidden rounded-xl">
        {/* Background Image */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${currentIndex}`}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <img
              src={currentStat.background}
              alt={currentStat.label}
              className="h-full w-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
        
        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateY: -90 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="text-center relative z-10"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-5xl md:text-6xl font-bold text-white mb-3"
            >
              {currentStat.number}
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-lg md:text-xl font-semibold text-white mb-1"
            >
              {currentStat.label}
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-xs md:text-sm text-white/80"
            >
              {currentStat.description}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center space-x-3 mt-6">
        {stats.map((_, index) => (
          <button
            key={index}
            onClick={() => handleDotClick(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-secondary-500 scale-125'
                : 'bg-secondary-200 hover:bg-secondary-300'
            }`}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="w-full bg-secondary-100 rounded-full h-1">
          <motion.div
            className="bg-secondary-500 h-1 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${((currentIndex + 1) / stats.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  )
}

export default InteractiveStatsMatrix
