import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(useGSAP, CustomEase)

export const HOME_EASE_OUT = CustomEase.create('home-ease-out', '0.23,1,0.32,1')
export const HOME_REVEAL_DURATION = 0.5
export const HOME_STAGGER = 0.05
