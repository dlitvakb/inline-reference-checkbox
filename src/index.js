import React from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import { CheckboxField, FieldGroup, Spinner } from '@contentful/forma-36-react-components'
import { init } from 'contentful-ui-extensions-sdk'
import '@contentful/forma-36-react-components/dist/styles.css'
import './index.css'

export class App extends React.Component {
  static propTypes = {
    sdk: PropTypes.object.isRequired
  }

  detachExternalChangeHandler = null

  constructor(props) {
    super(props)
    this.state = {
      value: props.sdk.field.getValue() || '',
      possibleValues: [],
      contentTypes: {},
      loading: true
    }
  }

  async fetchPossibleValues() {
    const currentField = this.props.sdk.field

    let referenceContentTypes
    try {
      referenceContentTypes = currentField.items.validations.find(v => 'linkContentType' in v).linkContentType
    } catch {
      referenceContentTypes = []
    }

    const query = referenceContentTypes.length > 0 ? {"sys.contentType.sys.id[in]": referenceContentTypes.join(", ")} : {}
    return (await this.props.sdk.space.getEntries(query)).items
  }

  fetchContentTypes = async () =>{
    const contentTypeCollection = await this.props.sdk.space.getContentTypes({limit: 1000})
    let result = {}
    contentTypeCollection.items.forEach(ct => {
      result[ct.sys.id] = ct
    })
    return result
  }

  async componentDidMount() {
    this.props.sdk.window.startAutoResizer()

    this.setState({contentTypes: await this.fetchContentTypes(), possibleValues: await this.fetchPossibleValues(), loading: false})

    // Handler for external field value changes (e.g. when multiple authors are working on the same entry).
    this.detachExternalChangeHandler = this.props.sdk.field.onValueChanged(this.onExternalChange)
  }

  componentWillUnmount() {
    if (this.detachExternalChangeHandler) {
      this.detachExternalChangeHandler()
    }
  }

  onExternalChange = value => {
    this.setState({ value })
  }

  inValue = entry => {
    const value = this.state.value || []
    return value.some(e => {
      return e.sys.id === entry.sys.id
    })
  }

  orphanedValues = () => {
    let orphaned = []
    const value = this.state.value || []
    value.forEach(v => {
      if (!(this.state.possibleValues || []).some(pv => v.sys.id === pv.sys.id)) {
        orphaned.push(v)
      }
    })
    return orphaned
  }

  asLink = entry => {
    return {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: entry.sys.id
      }
    }
  }

  onChange = e => {
    const checkboxValue = JSON.parse(e.currentTarget.value)
    let currentValue = this.state.value || []

    if (e.currentTarget.checked && !this.inValue(checkboxValue)) {
      currentValue = [...currentValue, checkboxValue]
    } else {
      currentValue = currentValue.filter(e => e.sys.id !== checkboxValue.sys.id)
    }

    this.props.sdk.field.setValue(currentValue)
    this.setState({value: currentValue})
  }

  render() {
    if (this.state.loading) {
      return <Spinner />
    }
    if (this.state.possibleValues.length === 0 && this.state.value) {
      return (
        <p><i>No references found to be linked</i></p>
      )
    }

    const orphanedValues = this.orphanedValues()
    return (
      <>
        <FieldGroup row={false}>
          {this.state.possibleValues.map(e => {
            const contentType = this.state.contentTypes[e.sys.contentType.sys.id]

            return <CheckboxField
              key={e.sys.id}
              value={JSON.stringify(this.asLink(e))}
              labelText={e.fields[contentType.displayField] ? e.fields[contentType.displayField][this.props.sdk.locales.default] : 'Untitled'}
              helpText={contentType.name}
              checked={this.inValue(e)}
              id={`check-${e.sys.id}`}
              onChange={this.onChange}
            />
          })}
        </FieldGroup>

        { orphanedValues.length > 0 && (
          <>
            <br />
            <h4>Deleted entries - <i>should be removed</i></h4>
            <FieldGroup row={false}>
              {this.orphanedValues().map(e => {
                return <CheckboxField
                  key={e.sys.id}
                  value={JSON.stringify(this.asLink(e))}
                  labelText={`Deleted - ID: ${e.sys.id}`}
                  helpText="Deleted Entry"
                  checked={this.inValue(e)}
                  id={`check-${e.sys.id}`}
                  onChange={this.onChange}
                />
              })}
            </FieldGroup>
          </>
        )}
      </>
    )
  }
}

init(sdk => {
  ReactDOM.render(<App sdk={sdk} />, document.getElementById('root'))
})

/**
 * By default, iframe of the extension is fully reloaded on every save of a source file.
 * If you want to use HMR (hot module reload) instead of full reload, uncomment the following lines
 */
// if (module.hot) {
//   module.hot.accept()
// }
