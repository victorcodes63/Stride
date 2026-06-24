'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Clock, ArrowRight, ExternalLink, Star } from 'lucide-react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import SectionTitle from '@/components/SectionTitle';
import { htmlToListPreviewItems } from '@/lib/job-list-html';

type FeaturedJob = {
  id: string;
  slug?: string;
  title: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  postedDate: string;
};

const FeaturedJobs = () => {
  const isDesktop = useIsDesktop();
  const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/jobs?activeOnly=true')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const mapped: FeaturedJob[] = data.slice(0, 3).map((job: {
          id: string;
          slug?: string;
          title: string;
          location: string;
          type: string;
          description: string;
          requirements: string;
          postedDate: string;
        }) => ({
          id: job.id,
          slug: job.slug,
          title: job.title,
          location: job.location,
          type: job.type,
          description: job.description,
          requirements: typeof job.requirements === 'string' ? job.requirements : '',
          postedDate: job.postedDate,
        }));
        setFeaturedJobs(mapped);
      })
      .catch(() => {
        if (!cancelled) setFeaturedJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getTypeColor = (type: string) => {
    switch (type.trim().toLowerCase()) {
      case 'full-time':
      case 'full time':
        return 'bg-green-100 text-green-800';
      case 'part-time':
      case 'part time':
        return 'bg-blue-100 text-blue-800';
      case 'contract':
        return 'bg-purple-100 text-purple-800';
      case 'remote':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isNewJob = (dateString: string) => {
    const jobDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - jobDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7; // New if posted within 7 days
  };

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.6 : 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: isDesktop ? 0.6 : 0, delay: isDesktop ? 0.2 : 0 }}
            viewport={{ once: true }}
          >
            <SectionTitle
              label="Careers"
              title="Featured"
              titleLine2="career opportunities."
              subtitle="Explore current openings from organisations we support across Kenya. Find roles that match your experience, qualifications, and career goals."
              variant="section"
              className="mb-8"
            />
          </motion.div>

          {/* Company Stats */}
          <motion.div
            initial={isDesktop ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: isDesktop ? 0.6 : 0, delay: isDesktop ? 0.4 : 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 max-w-2xl mx-auto"
          >
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary-900 mb-1">7+</div>
              <div className="text-xs md:text-sm text-neutral-600">Years Experience</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary-900 mb-1">100+</div>
              <div className="text-xs md:text-sm text-neutral-600">Companies Served</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary-900 mb-1">50+</div>
              <div className="text-xs md:text-sm text-neutral-600">Team Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary-900 mb-1">98%</div>
              <div className="text-xs md:text-sm text-neutral-600">Success Rate</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Featured Jobs Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-white border border-neutral-200 rounded-xl p-4 md:p-6 h-[330px]">
                <div className="h-5 w-2/3 bg-neutral-200 rounded mb-4" />
                <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2" />
                <div className="h-4 w-1/2 bg-neutral-200 rounded mb-6" />
                <div className="h-20 bg-neutral-200 rounded mb-6" />
                <div className="h-10 bg-neutral-200 rounded" />
              </div>
            ))}
          </div>
        ) : featuredJobs.length === 0 ? (
          <div className="text-center text-neutral-600 mb-12">
            No featured opportunities available right now.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
            {featuredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: isDesktop ? index * 0.1 : 0, duration: isDesktop ? 0.6 : 0 }}
                viewport={{ once: true }}
                className="group bg-white border border-neutral-200 rounded-xl p-4 md:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
              >
                {/* Job Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex-1">
                      <h3 className="text-base md:text-lg font-heading font-semibold text-primary-900 group-hover:text-secondary-500 transition-colors duration-200">
                        {job.title}
                      </h3>
                      {isNewJob(job.postedDate) && (
                        <div className="inline-flex items-center mt-1">
                          <Star className="w-3 h-3 text-secondary-500 mr-1" />
                          <span className="text-xs text-secondary-500 font-medium">New</span>
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-medium flex-shrink-0 ${getTypeColor(job.type)}`}>
                      {job.type.replace('-', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center text-sm text-neutral-600 mb-2">
                    <MapPin className="w-4 h-4 mr-1" />
                    {job.location}
                  </div>

                  <div className="flex items-center text-sm text-neutral-600">
                    <Clock className="w-4 h-4 mr-1" />
                    Posted {formatDate(job.postedDate)}
                  </div>
                </div>

                {/* Content Area - This will grow to fill available space */}
                <div className="flex-1 flex flex-col">
                  {/* Job Description */}
                  <p className="text-neutral-600 text-sm mb-4 line-clamp-3 whitespace-pre-line">
                    {job.description}
                  </p>

                  {/* Requirements Preview */}
                  {(() => {
                    const reqItems = htmlToListPreviewItems(job.requirements, 2);
                    if (reqItems.length === 0) return null;
                    const totalCount = htmlToListPreviewItems(job.requirements, 999).length;
                    return (
                      <div className="mb-4 md:mb-6 flex-1">
                        <h4 className="text-xs md:text-sm font-medium text-primary-900 mb-2 md:mb-3">Key Requirements:</h4>
                        <ul className="space-y-1 md:space-y-2">
                          {reqItems.map((requirement, reqIndex) => (
                            <li key={reqIndex} className="text-xs md:text-sm text-neutral-700 flex items-center">
                              <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-secondary-500 rounded-full mr-2 md:mr-3 flex-shrink-0"></div>
                              {requirement}
                            </li>
                          ))}
                          {totalCount > 2 && (
                            <li className="text-xs md:text-sm text-neutral-600">
                              +{totalCount - 2} more requirements
                            </li>
                          )}
                        </ul>
                      </div>
                    );
                  })()}
                </div>

                <Link
                  href={`/careers/apply/${job.slug ?? job.id}`}
                  className="w-full bg-primary-900 text-white py-2.5 md:py-2 px-4 rounded-lg font-medium hover:bg-primary-800 transition-colors duration-200 flex items-center justify-center group text-sm md:text-base mt-auto"
                >
                  Apply Now
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <motion.div
          initial={isDesktop ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: isDesktop ? 0.6 : 0, delay: isDesktop ? 0.3 : 0 }}
          viewport={{ once: true }}
          className="text-center bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-2xl p-6 md:p-8 lg:p-12"
        >
          <h3 className="text-xl md:text-2xl lg:text-3xl font-heading font-bold text-primary-900 mb-3 md:mb-4">
            Don&apos;t See a Suitable Role Yet?
          </h3>
          <p className="text-base md:text-lg text-neutral-600 mb-6 md:mb-8 max-w-2xl mx-auto">
            New vacancies are added regularly from our client network. Share your
            profile and we&apos;ll contact you when a relevant opportunity opens up.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
            <Link
              href="/careers"
              className="group bg-primary-900 text-white px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold text-base md:text-lg hover:bg-primary-800 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center"
            >
              View All Openings
              <ExternalLink className="ml-2 w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            
            <Link
              href="/contact"
              className="group border-2 border-primary-900 text-primary-900 px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold text-base md:text-lg hover:bg-primary-900 hover:text-white transition-all duration-300 flex items-center justify-center"
            >
              Submit Your Resume
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedJobs;

