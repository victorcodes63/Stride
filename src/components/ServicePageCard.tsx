'use client';

import { motion } from 'framer-motion';
import { CheckCircle, LucideIcon } from 'lucide-react';

/**
 * Reusable card for individual service pages (non-recruitment).
 * Keeps a consistent pattern: cream+gold icon, title, description, feature list with checkmarks.
 * Use after SectionTitle for "Our services" / "Assessment types" / "Solutions" sections.
 */
export type ServicePageCardItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
};

type ServicePageCardProps = {
  item: ServicePageCardItem;
  index?: number;
};

export default function ServicePageCard({ item, index = 0 }: ServicePageCardProps) {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      viewport={{ once: true }}
      className="bg-white border border-neutral-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
    >
      <div className="w-16 h-16 bg-secondary-50 rounded-xl flex items-center justify-center mb-6 border border-secondary-100">
        <Icon className="w-8 h-8 text-secondary-500" />
      </div>
      <h3 className="text-xl font-heading font-semibold text-primary-900 mb-4">
        {item.title}
      </h3>
      <p className="text-neutral-600 mb-6 leading-relaxed">
        {item.description}
      </p>
      <ul className="space-y-2">
        {item.features.map((feature, featureIndex) => (
          <li key={featureIndex} className="flex items-center text-sm text-neutral-600">
            <CheckCircle className="w-4 h-4 text-secondary-500 mr-2 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
