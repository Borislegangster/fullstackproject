import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  CalendarIcon,
  UserIcon,
  ClockIcon,
  Share2Icon,
  FacebookIcon,
  TwitterIcon,
  LinkedinIcon,
  HomeIcon,
  ChevronRightIcon,
  CheckIcon } from
'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getBlogPostBySlug, getAllBlogPosts } from '../../services/api/cms.api';
import { SkeletonHero, SkeletonText } from '../../components/ui/Skeleton';
export function BlogDetailPage() {
  const { slug } = useParams<{
    slug: string;
  }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const { data: postData, isLoading: isLoadingPost } = useCmsQuery(
    ['blog-post', slug || ''],
    () => getBlogPostBySlug(slug || '')
  );
  const { data: blogPostsData = [], isLoading: isLoadingPosts } = useCmsQuery(
    'blog-posts',
    getAllBlogPosts
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (isLoadingPost || isLoadingPosts) {
    return (
      <div className="pt-28 pb-20 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <SkeletonText lines={1} className="mb-8 w-1/3 mx-auto" />
          <SkeletonText lines={2} className="mb-8" />
          <SkeletonHero className="h-[40vh] min-h-[350px] mb-16 rounded-3xl" />
          <SkeletonText lines={10} />
        </div>
      </div>);

  }
  // Find article or fallback
  const post = postData || blogPostsData[0];
  if (!post) {
    return (
      <div className="pt-32 pb-20 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <SEOHead title="Article introuvable" description="Article non trouvé" />
        <h1 className="text-3xl font-montserrat font-bold text-globus-blue-dark mb-4">
          Article introuvable
        </h1>
        <Link
          to="/blog"
          className="text-globus-orange hover:underline flex items-center gap-2">
          
          <ArrowLeftIcon className="w-4 h-4" /> Retour au blog
        </Link>
      </div>);

  }
  // Get related articles (same category, excluding current)
  const relatedArticles = blogPostsData.
  filter((p) => p.category === post.category && p.id !== post.id).
  slice(0, 2);
  // If not enough related in same category, just grab recent ones
  if (relatedArticles.length < 2) {
    const more = blogPostsData.
    filter(
      (p) => p.id !== post.id && !relatedArticles.find((r) => r.id === p.id)
    ).
    slice(0, 2 - relatedArticles.length);
    relatedArticles.push(...more);
  }
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20 bg-gray-50">
      <SEOHead
        title={post.title}
        description={post.excerpt}
        ogImage={post.image}
        ogType="article"
        canonicalPath={`/blog/${slug}`} />
      
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm font-opensans text-globus-gray mb-8">
            <Link
              to="/"
              className="hover:text-globus-orange transition-colors flex items-center gap-1">
              
              <HomeIcon className="w-4 h-4" /> Accueil
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <Link
              to="/blog"
              className="hover:text-globus-orange transition-colors">
              
              Blog
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-globus-blue-dark font-semibold truncate max-w-[200px] sm:max-w-[400px]">
              {post.title}
            </span>
          </nav>

          {/* Article Header */}
          <header className="mb-10 text-center">
            <span className="inline-block bg-globus-orange/10 text-globus-orange font-montserrat font-bold text-sm px-4 py-1.5 rounded-full mb-6">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-montserrat font-extrabold text-globus-blue-dark mb-8 leading-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap justify-center items-center gap-6 text-globus-gray font-opensans text-sm font-semibold bg-globus-light py-4 px-6 rounded-2xl inline-flex">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-globus-blue rounded-full flex items-center justify-center text-white">
                  <UserIcon className="w-4 h-4" />
                </div>
                <span className="text-globus-blue-dark">{post.author}</span>
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-globus-orange" />{' '}
                {post.date}
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-globus-orange" /> Lecture :{' '}
                {post.readTime}
              </div>
            </div>
          </header>

          {/* Featured Image */}
          <div className="rounded-3xl overflow-hidden shadow-2xl mb-16 h-[40vh] min-h-[350px] relative">
            <img
              src={post.image}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover" />
            
          </div>

          {/* Rich Text Content */}
          <article className="prose prose-lg md:prose-xl max-w-none font-opensans text-globus-gray prose-headings:font-montserrat prose-headings:font-bold prose-headings:text-globus-blue-dark prose-a:text-globus-orange hover:prose-a:text-globus-orange-hover prose-img:rounded-2xl prose-img:shadow-lg">
            <p className="lead text-xl md:text-2xl text-globus-blue-dark font-semibold mb-10 leading-relaxed">
              {post.excerpt}
            </p>
            {post.htmlContent &&
            <div
              dangerouslySetInnerHTML={{
                __html: post.htmlContent
              }} />

            }
          </article>

          {/* Share & Tags */}
          <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="font-montserrat font-bold text-globus-blue-dark">
                Partager cet article :
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                  window.open(
                    `https://www.linkedin.com/sharing/share-offsite/?url=${window.location.href}`,
                    '_blank'
                  )
                  }
                  className="w-12 h-12 rounded-full bg-globus-light hover:bg-[#0077b5] hover:text-white flex items-center justify-center text-globus-gray transition-all shadow-sm hover:shadow-md hover:-translate-y-1">
                  
                  <LinkedinIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                  window.open(
                    `https://twitter.com/intent/tweet?url=${window.location.href}&text=${post.title}`,
                    '_blank'
                  )
                  }
                  className="w-12 h-12 rounded-full bg-globus-light hover:bg-[#1DA1F2] hover:text-white flex items-center justify-center text-globus-gray transition-all shadow-sm hover:shadow-md hover:-translate-y-1">
                  
                  <TwitterIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${window.location.href}`,
                    '_blank'
                  )
                  }
                  className="w-12 h-12 rounded-full bg-globus-light hover:bg-[#4267B2] hover:text-white flex items-center justify-center text-globus-gray transition-all shadow-sm hover:shadow-md hover:-translate-y-1">
                  
                  <FacebookIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={handleShare}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm hover:shadow-md hover:-translate-y-1 ${copied ? 'bg-green-500 text-white' : 'bg-globus-light hover:bg-globus-orange hover:text-white text-globus-gray'}`}>
                  
                  {copied ?
                  <CheckIcon className="w-5 h-5" /> :

                  <Share2Icon className="w-5 h-5" />
                  }
                </button>
              </div>
            </div>
            <Link
              to="/blog"
              className="text-globus-blue font-montserrat font-bold hover:text-globus-orange transition-colors flex items-center gap-2">
              
              <ArrowLeftIcon className="w-4 h-4" /> Retour au blog
            </Link>
          </div>

          {/* Related Articles */}
          <div className="mt-20 bg-globus-light rounded-3xl p-8 md:p-12 shadow-inner">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-globus-orange rounded-full"></div>
              <h3 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                Ces articles pourraient vous intéresser
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {relatedArticles.map((item) =>
              <Link
                to={`/blog/${item.id}`}
                key={item.id}
                className="group flex flex-col sm:flex-row gap-6 bg-white p-5 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-1">
                
                  <div className="w-full sm:w-2/5 h-40 sm:h-auto rounded-xl overflow-hidden flex-shrink-0 relative">
                    <img
                    src={item.image}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                  
                  </div>
                  <div className="flex flex-col justify-center py-2">
                    <span className="text-globus-orange font-montserrat font-bold text-xs mb-2 uppercase tracking-wider">
                      {item.category}
                    </span>
                    <h4 className="font-montserrat font-bold text-globus-blue-dark group-hover:text-globus-blue transition-colors line-clamp-2 mb-3 leading-snug">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-3 text-globus-gray font-opensans text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" /> {item.date}
                      </span>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>);

}