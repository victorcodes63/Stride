'use client';

import { motion } from 'framer-motion';
import { TeamMember as TeamMemberType } from '@/types';
import Image from 'next/image';

interface TeamMemberProps {
  member: TeamMemberType;
  index: number;
}

const TeamMember = ({ member, index }: TeamMemberProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      viewport={{ once: true }}
      className="group bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
    >
      {/* Image */}
      <div className="relative mb-6 overflow-hidden rounded-lg">
        <div className="aspect-square rounded-lg overflow-hidden">
          <Image
            src={member.image}
            alt={member.name}
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <div className="text-center">
        <h3 className="text-xl font-heading font-semibold text-primary-900 mb-1">
          {member.name}
        </h3>
        <p className="text-secondary-500 font-medium mb-3">
          {member.position}
        </p>
        <p className="text-neutral-600 text-sm leading-relaxed">
          {member.bio}
        </p>
      </div>
    </motion.div>
  );
};

export default TeamMember;


