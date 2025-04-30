import React from 'react'
import { Button } from "@nextui-org/react"
import { Card, CardHeader, CardBody, CardFooter } from "@nextui-org/react"
import { Badge } from "@nextui-org/react"
import { ChevronDown, ChevronUp, Clock, Share } from 'lucide-react'
import { useState } from 'react'

export default function StudyItineraryPage(data: {data:any}) {
  const [roteiro, setRoteiro] = useState(data.data);
  console.log(roteiro)
  const [expandedItems, setExpandedItems] = React.useState<number[]>([])

  const toggleItem = (index: number) => {
    setExpandedItems(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  return (
    <div className="min-h-screen md:w-[60vw] w-[90vw] rounded-2xl mb-4 bg-gray-100 roteiro">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex flex-col gap-6">
            <div className="">
              <Card>
                {roteiro.content && ( // Add conditional check here
                  <CardHeader className='flex-col items-start'>
                    <h2 className="text-xl font-semibold">{roteiro.content.title}</h2>
                    <span className="text-sm text-zinc-400">{roteiro.content.details.objective}</span>
                  </CardHeader>
                )}
                <CardBody>
                  <p className='mb-4 '>{roteiro.content.introduction}</p> 
                  {roteiro.content && roteiro.content.items.map((item:any, index: number) => ( // Add conditional check here
                    <div key={index} className="mb-4 border-b-1 border-zinc-300 pb-4">
                      <div
                        className="md:flex justify-between mb-2 items-center cursor-pointer"
                        onClick={() => toggleItem(index)}
                      >
                        <h3 className="text-lg font-semibold">{item.title}</h3>
                        <div className="flex items-center">
                          <Badge color="primary" variant="flat" className="mr-2  md:mt-0 flex items-center justify-center">
                            <Clock className="w-3 mt-[5px] h-3 mr-1" />
                            {item.duration}
                          </Badge>
                          {expandedItems.includes(index) ? <ChevronUp /> : <ChevronDown />}
                        </div>
                      </div>
                      {expandedItems.includes(index) && (
                        <div dangerouslySetInnerHTML={{__html: item.content}}></div>
                      )}
                    </div>
                  ))}
                </CardBody>
                <CardFooter>
                  <p className="text-sm text-gray-500">Tempo de estudo total: {roteiro.content.details.timeToComplete}</p>
                </CardFooter>
              </Card>
            </div>
            <div className="">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Detalhes do roteiro</h2>
                </CardHeader>
                <CardBody>
                  <div className="">
                    <div className="flex items-center mb-4">
                      <span> <strong>Desrição:</strong> {roteiro.content.description}</span>
                    </div>
                    <div className="flex items-center mb-4">
                      <span> <strong>Instruções: </strong> {roteiro.content.instructions}</span>
                    </div>

                  </div>
                </CardBody>
                <CardFooter className="flex flex-col space-y-2 items-start">
                  <Button color="primary" variant='flat' className='w-full' onClick={() => navigator.clipboard.writeText(window.location.href)}>
                    <Share className="w-4 h-4 mr-2" />
                    Compartilhar Roteiro
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
