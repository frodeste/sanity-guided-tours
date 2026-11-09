'use client'

import '@sanity/ui/styles.css'
import 'sanity-plugin-guided-tours/react/styles.css'

import {NextStudio} from 'next-sanity/studio'

import config from '../../../sanity.config'

export default function Studio() {
  return <NextStudio config={config} />
}
