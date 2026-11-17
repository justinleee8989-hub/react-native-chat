import React from 'react'
import { render } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'

import { BubbleGradientContext, GradientBubbleBackground } from '../components/BubbleBackground'

it.each([undefined, 'left', 'right'] as const)('registers tail color work only for a visible tail (%s)', async tailSide => {
  const derived = jest.spyOn(Reanimated, 'useDerivedValue')
  const store = {
    scrolledY: Reanimated.makeMutable(0),
    listHeight: Reanimated.makeMutable(800),
    cellLayout: () => Reanimated.makeMutable({ y: 0, height: 60 }),
    isInverted: false,
  }
  await render(
    <BubbleGradientContext.Provider value={store}>
      <GradientBubbleBackground stops={['#6E6BF2', '#0087F2']} mode='window' messageId='qa' bottomGap={0} cornerStyle={{}} tailSide={tailSide} />
    </BubbleGradientContext.Provider>
  )
  expect(derived).toHaveBeenCalledTimes(tailSide ? 1 : 0)
  derived.mockRestore()
})
